/**
 * Image Share Server
 * Main entry point for the backend server
 * 
 * Features:
 * - Real-time WebSocket communication via Socket.IO
 * - In-memory only image storage (no persistence)
 * - Automatic session cleanup with TTL
 * - Binary image transfer (no Base64)
 * - Share Target API support for PWA
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { SERVER_CONFIG, FILE_CONFIG } from './config/constants.js';
import { initializeSocketHandlers } from './socket/socket-handler.js';
import cleanupService from './services/cleanup-service.js';
import sessionService from './services/session-service.js';
import fileService from './services/file-service.js';
import keepAliveService from './services/keep-alive-service.js';
import analyticsService from './services/analytics-service.js';
import imageOptimizationService from './services/image-optimization-service.js';
import batchDownloadService from './services/batch-download-service.js';
import { apiLimiter, uploadLimiter, sessionLimiter, analyticsLimiter } from './services/rate-limit-service.js';
import { isValidSessionIdFormat } from './utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to client build folder
const clientBuildPath = join(__dirname, '../client/dist');

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Trust proxy for Render/cloud deployment - essential for rate limiting to work correctly
app.set('trust proxy', 1);

// Determine allowed origins
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? true  // Allow all origins in production (same-origin requests from static files)
  : ['http://localhost:5173', 'http://127.0.0.1:5173', `http://${process.env.HOST || 'localhost'}:5173`];

// Initialize Socket.IO with production-optimized settings
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: FILE_CONFIG.MAX_SIZE_BYTES + 1024 * 1024, // File size + 1MB metadata

  // Connection timeouts optimized for Render/cloud deployment
  pingTimeout: 120000, // 2 minutes - longer for slow networks
  pingInterval: 25000, // 25 seconds - keep connection alive

  // Transport settings for load balancers
  transports: ['websocket', 'polling'], // Prefer websocket
  allowUpgrades: true,
  upgradeTimeout: 30000, // 30 seconds to upgrade

  // Connection settings
  connectTimeout: 45000, // 45 seconds connection timeout

  // Enable sticky sessions support
  cookie: {
    name: 'io',
    path: '/',
    httpOnly: true,
    sameSite: 'lax'
  },

  // Reliability settings
  perMessageDeflate: {
    threshold: 1024 // Compress messages > 1KB
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      workerSrc: ["'self'", 'blob:'],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Parse JSON for API routes
app.use(express.json({ limit: '1mb' }));

// Parse raw binary data for share target
app.use('/api/share-target', express.raw({
  type: 'multipart/form-data',
  limit: `${FILE_CONFIG.MAX_SIZE_BYTES}b`
}));

// Health check endpoint (for Render)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Lightweight cron ping endpoint (for cron-job.org)
app.get('/api/cron/ping', (req, res) => {
  console.log('Cron keep-alive triggered');
  res.status(200).send('OK');
});

// Health check endpoint with stats
app.get('/api/health', (req, res) => {
  const stats = cleanupService.getStats();
  const socketStats = {
    connected: io.engine.clientsCount || 0,
    rooms: io.sockets.adapter.rooms.size || 0
  };

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memory: {
      usedMB: (stats.totalBytes / 1024 / 1024).toFixed(2),
      maxMB: (stats.maxBytes / 1024 / 1024).toFixed(2),
      usagePercent: stats.usagePercent.toFixed(1)
    },
    sessions: stats.sessionCount,
    files: stats.fileCount,
    connections: socketStats
  });
});

// Validate session endpoint
app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!isValidSessionIdFormat(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }

  const sessionInfo = sessionService.getSessionInfo(sessionId);

  if (!sessionInfo) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  res.json(sessionInfo);
});

// Analytics endpoint
app.get('/api/analytics', analyticsLimiter, (req, res) => {
  const stats = analyticsService.getStats();
  res.json(stats);
});

// Batch download endpoint - download all files in a session as ZIP
app.get('/api/session/:sessionId/download-all', apiLimiter, async (req, res) => {
  const { sessionId } = req.params;

  if (!isValidSessionIdFormat(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }

  const sessionInfo = sessionService.getSessionInfo(sessionId);

  if (!sessionInfo) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  try {
    // Get all files from session
    const files = sessionInfo.files || [];

    if (files.length === 0) {
      return res.status(404).json({ error: 'No files in session' });
    }

    // Create ZIP archive
    const zipBuffer = await batchDownloadService.createZip(files);

    // Track download
    analyticsService.trackFileDownload();

    // Send ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}-files.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (error) {
    console.error('[BatchDownload] Error:', error);
    res.status(500).json({ error: 'Failed to create ZIP archive' });
  }
});

/**
 * Share Target Handler
 * Handles files shared from mobile OS share sheet
 * POST /api/share-target
 */
app.post('/api/share-target', async (req, res) => {
  try {
    // Get session ID from query or create new session
    let sessionId = req.query.session;

    if (!sessionId || !sessionService.isValidSession(sessionId)) {
      // Create new session for share target
      const newSession = sessionService.createSession();
      sessionId = newSession.sessionId;
    }

    // Parse multipart form data manually (no multer to avoid filesystem)
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
      // Extract boundary
      const boundary = contentType.split('boundary=')[1];

      if (boundary) {
        // Collect body chunks
        const chunks = [];

        req.on('data', chunk => chunks.push(chunk));

        req.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const files = parseMultipartFormData(buffer, boundary);

          // Process each file
          const results = [];
          for (const file of files) {
            const result = fileService.uploadFile(sessionId, file.buffer, {
              mimeType: file.mimeType,
              filename: file.filename
            }, 'share-target');

            if (result.success) {
              results.push(result.file);
              // Notify connected clients
              io.to(sessionId).emit('file:added', { file: result.file });
            }
          }

          // Redirect to session page
          res.redirect(`/?session=${sessionId}`);
        });

        return;
      }
    }

    // Fallback: redirect to session
    res.redirect(`/?session=${sessionId}`);
  } catch (error) {
    console.error('[ShareTarget] Error:', error);
    res.status(500).json({ error: 'Failed to process shared file' });
  }
});

/**
 * Parse multipart form data without filesystem access
 */
function parseMultipartFormData(buffer, boundary) {
  const files = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  let start = 0;
  let partStart = buffer.indexOf(boundaryBuffer, start);

  while (partStart !== -1) {
    const nextBoundary = buffer.indexOf(boundaryBuffer, partStart + boundaryBuffer.length);
    if (nextBoundary === -1) break;

    const part = buffer.slice(partStart + boundaryBuffer.length, nextBoundary);

    // Find header/body separator (double CRLF)
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      partStart = nextBoundary;
      continue;
    }

    const headerStr = part.slice(0, headerEnd).toString('utf8');
    const body = part.slice(headerEnd + 4, part.length - 2); // Remove trailing CRLF

    // Parse headers - Accept ANY file type
    const mimeMatch = headerStr.match(/Content-Type:\s*([\w+\-\.\/]+)/i);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/i);

    if (body.length > 0) {
      files.push({
        buffer: body,
        mimeType: mimeMatch ? mimeMatch[1] : 'application/octet-stream',
        filename: filenameMatch ? filenameMatch[1] : 'shared-file'
      });
    }

    partStart = nextBoundary;
  }

  return files;
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientBuildPath));

  // SPA fallback - must be after all API routes
  app.get('*', (req, res) => {
    res.sendFile(join(clientBuildPath, 'index.html'));
  });
}

// Initialize WebSocket handlers
initializeSocketHandlers(io);

// Initialize cleanup service
cleanupService.initialize(io);

// Start server
httpServer.listen(SERVER_CONFIG.PORT, SERVER_CONFIG.HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    FILE SHARE SERVER                       ║
╠════════════════════════════════════════════════════════════╣
║  Server running at http://${SERVER_CONFIG.HOST}:${SERVER_CONFIG.PORT}                  ║
║  WebSocket enabled                                         ║
║  Memory-only storage (no persistence)                      ║
║  Session TTL: 5 hours                                      ║
║  Max file size: ${FILE_CONFIG.MAX_SIZE_BYTES / 1024 / 1024}MB                                      ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Start keep-alive service to prevent Render spin-down
  if (process.env.RENDER) {
    const serverUrl = process.env.RENDER_EXTERNAL_URL || `http://${SERVER_CONFIG.HOST}:${SERVER_CONFIG.PORT}`;
    keepAliveService.start(serverUrl);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  keepAliveService.stop();
  cleanupService.stopCleanupTimer();
  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  keepAliveService.stop();
  cleanupService.stopCleanupTimer();
  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

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

import { SERVER_CONFIG, IMAGE_CONFIG } from './config/constants.js';
import { initializeSocketHandlers } from './socket/socket-handler.js';
import cleanupService from './services/cleanup-service.js';
import sessionService from './services/session-service.js';
import imageService from './services/image-service.js';
import { isValidSessionIdFormat } from './utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to client build folder
const clientBuildPath = join(__dirname, '../client/dist');

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Determine allowed origins
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? true  // Allow all origins in production (same-origin requests from static files)
  : ['http://localhost:5173', 'http://127.0.0.1:5173', `http://${process.env.HOST || 'localhost'}:5173`];

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: IMAGE_CONFIG.MAX_SIZE_BYTES + 1024, // Image size + metadata
  pingTimeout: 60000,
  pingInterval: 25000
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
  limit: `${IMAGE_CONFIG.MAX_SIZE_BYTES}b`
}));

// Health check endpoint (for Render)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Health check endpoint with stats
app.get('/api/health', (req, res) => {
  const stats = cleanupService.getStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memory: {
      usedMB: (stats.totalBytes / 1024 / 1024).toFixed(2),
      maxMB: (stats.maxBytes / 1024 / 1024).toFixed(2),
      usagePercent: stats.usagePercent.toFixed(1)
    },
    sessions: stats.sessionCount,
    images: stats.imageCount
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

/**
 * Share Target Handler
 * Handles images shared from mobile OS share sheet
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
          const images = parseMultipartFormData(buffer, boundary);
          
          // Process each image
          const results = [];
          for (const image of images) {
            const result = imageService.uploadImage(sessionId, image.buffer, {
              mimeType: image.mimeType,
              filename: image.filename
            }, 'share-target');
            
            if (result.success) {
              results.push(result.image);
              // Notify connected clients
              io.to(sessionId).emit('image:added', { image: result.image });
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
    res.status(500).json({ error: 'Failed to process shared image' });
  }
});

/**
 * Parse multipart form data without filesystem access
 */
function parseMultipartFormData(buffer, boundary) {
  const images = [];
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
    
    // Parse headers
    if (headerStr.includes('Content-Type: image/')) {
      const mimeMatch = headerStr.match(/Content-Type:\s*(image\/[\w+-]+)/i);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/i);
      
      if (mimeMatch && body.length > 0) {
        images.push({
          buffer: body,
          mimeType: mimeMatch[1],
          filename: filenameMatch ? filenameMatch[1] : 'shared-image'
        });
      }
    }
    
    partStart = nextBoundary;
  }
  
  return images;
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
║                    IMAGE SHARE SERVER                      ║
╠════════════════════════════════════════════════════════════╣
║  Server running at http://${SERVER_CONFIG.HOST}:${SERVER_CONFIG.PORT}                  ║
║  WebSocket enabled                                         ║
║  Memory-only storage (no persistence)                      ║
║  Session TTL: 1 hour                                       ║
║  Max image size: ${IMAGE_CONFIG.MAX_SIZE_BYTES / 1024 / 1024}MB                                       ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  cleanupService.stopCleanupTimer();
  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  cleanupService.stopCleanupTimer();
  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

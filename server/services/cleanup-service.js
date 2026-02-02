/**
 * Cleanup Service
 * Handles automatic session expiration and memory management
 */

import memoryStore from '../storage/memory-store.js';
import { SESSION_CONFIG, MEMORY_CONFIG } from '../config/constants.js';

class CleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.io = null;
  }

  /**
   * Initialize cleanup service with Socket.IO instance
   */
  initialize(io) {
    this.io = io;
    this.startCleanupTimer();
    console.log('[Cleanup] Service initialized');
  }

  /**
   * Start the periodic cleanup timer
   */
  startCleanupTimer() {
    // Clear any existing timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Run cleanup at configured interval
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, SESSION_CONFIG.CLEANUP_INTERVAL_MS);

    // Run initial cleanup
    this.runCleanup();
  }

  /**
   * Stop the cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Run cleanup cycle
   */
  runCleanup() {
    const startTime = Date.now();
    
    // Get expired sessions
    const expiredSessions = memoryStore.getExpiredSessions();
    
    if (expiredSessions.length > 0) {
      console.log(`[Cleanup] Found ${expiredSessions.length} expired sessions`);
      
      for (const sessionId of expiredSessions) {
        this.cleanupSession(sessionId);
      }
    }

    // Check memory pressure
    this.handleMemoryPressure();

    const duration = Date.now() - startTime;
    const stats = memoryStore.getMemoryStats();
    
    console.log(`[Cleanup] Completed in ${duration}ms. Memory: ${(stats.totalBytes / 1024 / 1024).toFixed(2)}MB (${stats.usagePercent.toFixed(1)}%), Sessions: ${stats.sessionCount}, Files: ${stats.fileCount}`);
  }

  /**
   * Cleanup a specific session
   */
  cleanupSession(sessionId) {
    // Notify connected clients before cleanup
    if (this.io) {
      this.io.to(sessionId).emit('session:expired', {
        sessionId,
        reason: 'Session has expired'
      });
    }

    // Delete session and all images
    const deleted = memoryStore.deleteSession(sessionId);
    
    if (deleted) {
      console.log(`[Cleanup] Session ${sessionId.substring(0, 8)}... deleted`);
    }
  }

  /**
   * Handle memory pressure situations
   */
  handleMemoryPressure() {
    const stats = memoryStore.getMemoryStats();
    const usageRatio = stats.totalBytes / MEMORY_CONFIG.MAX_TOTAL_BYTES;

    if (usageRatio >= MEMORY_CONFIG.CRITICAL_THRESHOLD) {
      console.warn('[Cleanup] CRITICAL memory pressure! Forcing cleanup of oldest sessions');
      this.forceCleanupOldestSessions(5); // Remove 5 oldest sessions
    } else if (usageRatio >= MEMORY_CONFIG.WARNING_THRESHOLD) {
      console.warn('[Cleanup] WARNING: High memory usage detected');
    }
  }

  /**
   * Force cleanup of oldest sessions during memory pressure
   */
  forceCleanupOldestSessions(count) {
    const sessions = Array.from(memoryStore.sessions.entries())
      .map(([id, session]) => ({ id, createdAt: session.createdAt }))
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, count);

    for (const session of sessions) {
      console.log(`[Cleanup] Force removing session ${session.id.substring(0, 8)}... (memory pressure)`);
      this.cleanupSession(session.id);
    }
  }

  /**
   * Get memory statistics
   */
  getStats() {
    return memoryStore.getMemoryStats();
  }
}

const cleanupService = new CleanupService();
export default cleanupService;

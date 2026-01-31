/**
 * In-Memory Storage Manager
 * Stores all session and image data in RAM only
 * No persistence - all data lost on server restart
 */

import { SESSION_CONFIG, IMAGE_CONFIG, MEMORY_CONFIG } from '../config/constants.js';

/**
 * Session structure:
 * {
 *   id: string,
 *   createdAt: number (timestamp),
 *   expiresAt: number (timestamp),
 *   images: Map<imageId, ImageData>,
 *   members: Set<socketId>
 * }
 * 
 * ImageData structure:
 * {
 *   id: string,
 *   buffer: Buffer (binary data),
 *   mimeType: string,
 *   filename: string,
 *   size: number,
 *   uploadedAt: number (timestamp),
 *   uploadedBy: string (socketId)
 * }
 */

class MemoryStore {
  constructor() {
    // Main session storage: Map<sessionId, Session>
    this.sessions = new Map();
    
    // Track total memory usage
    this.totalMemoryUsage = 0;
    
    // Socket to session mapping for quick lookup
    this.socketToSession = new Map();
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats() {
    return {
      totalBytes: this.totalMemoryUsage,
      maxBytes: MEMORY_CONFIG.MAX_TOTAL_BYTES,
      usagePercent: (this.totalMemoryUsage / MEMORY_CONFIG.MAX_TOTAL_BYTES) * 100,
      sessionCount: this.sessions.size,
      imageCount: this.getTotalImageCount()
    };
  }

  /**
   * Get total image count across all sessions
   */
  getTotalImageCount() {
    let count = 0;
    for (const session of this.sessions.values()) {
      count += session.images.size;
    }
    return count;
  }

  /**
   * Check if memory is available for new data
   */
  hasAvailableMemory(requiredBytes) {
    return (this.totalMemoryUsage + requiredBytes) <= MEMORY_CONFIG.MAX_TOTAL_BYTES;
  }

  /**
   * Check if memory usage is critical
   */
  isMemoryCritical() {
    return this.totalMemoryUsage >= (MEMORY_CONFIG.MAX_TOTAL_BYTES * MEMORY_CONFIG.CRITICAL_THRESHOLD);
  }

  /**
   * Create a new session
   */
  createSession(sessionId) {
    const now = Date.now();
    const session = {
      id: sessionId,
      createdAt: now,
      expiresAt: now + SESSION_CONFIG.TTL_MS,
      images: new Map(),
      members: new Set()
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    // Return null if session doesn't exist or is expired
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.deleteSession(sessionId);
      return null;
    }
    
    return session;
  }

  /**
   * Check if session exists and is valid
   */
  isValidSession(sessionId) {
    return this.getSession(sessionId) !== null;
  }

  /**
   * Delete a session and all its images
   */
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Free memory from all images
    for (const image of session.images.values()) {
      this.totalMemoryUsage -= image.size;
    }

    // Clear image map
    session.images.clear();
    
    // Remove socket mappings for this session
    for (const socketId of session.members) {
      this.socketToSession.delete(socketId);
    }
    
    // Delete session
    this.sessions.delete(sessionId);
    
    return true;
  }

  /**
   * Add a member (socket) to a session
   */
  addMember(sessionId, socketId) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.members.add(socketId);
    this.socketToSession.set(socketId, sessionId);
    return true;
  }

  /**
   * Remove a member from a session
   */
  removeMember(socketId) {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (session) {
      session.members.delete(socketId);
    }
    
    this.socketToSession.delete(socketId);
    return sessionId;
  }

  /**
   * Get session ID for a socket
   */
  getSessionForSocket(socketId) {
    return this.socketToSession.get(socketId);
  }

  /**
   * Add an image to a session
   */
  addImage(sessionId, imageId, imageData) {
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found or expired' };
    }

    // Check session image limit
    if (session.images.size >= SESSION_CONFIG.MAX_IMAGES_PER_SESSION) {
      return { success: false, error: 'Maximum images per session reached' };
    }

    // Check image size
    if (imageData.buffer.length > IMAGE_CONFIG.MAX_SIZE_BYTES) {
      return { success: false, error: 'Image exceeds maximum size limit' };
    }

    // Check MIME type
    if (!IMAGE_CONFIG.ALLOWED_TYPES.includes(imageData.mimeType)) {
      return { success: false, error: 'Invalid image type' };
    }

    // Check memory availability
    if (!this.hasAvailableMemory(imageData.buffer.length)) {
      return { success: false, error: 'Server memory limit reached' };
    }

    const image = {
      id: imageId,
      buffer: imageData.buffer,
      mimeType: imageData.mimeType,
      filename: imageData.filename || `image-${imageId}`,
      size: imageData.buffer.length,
      uploadedAt: Date.now(),
      uploadedBy: imageData.uploadedBy
    };

    session.images.set(imageId, image);
    this.totalMemoryUsage += image.size;

    return { 
      success: true, 
      image: {
        id: image.id,
        mimeType: image.mimeType,
        filename: image.filename,
        size: image.size,
        uploadedAt: image.uploadedAt
      }
    };
  }

  /**
   * Get image metadata (without buffer)
   */
  getImageMetadata(sessionId, imageId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const image = session.images.get(imageId);
    if (!image) return null;

    return {
      id: image.id,
      mimeType: image.mimeType,
      filename: image.filename,
      size: image.size,
      uploadedAt: image.uploadedAt
    };
  }

  /**
   * Get image with buffer (for download)
   */
  getImageWithBuffer(sessionId, imageId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    return session.images.get(imageId) || null;
  }

  /**
   * Get all image metadata for a session
   */
  getSessionImages(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return [];

    return Array.from(session.images.values()).map(image => ({
      id: image.id,
      mimeType: image.mimeType,
      filename: image.filename,
      size: image.size,
      uploadedAt: image.uploadedAt
    }));
  }

  /**
   * Delete an image from a session
   */
  deleteImage(sessionId, imageId) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const image = session.images.get(imageId);
    if (!image) return false;

    this.totalMemoryUsage -= image.size;
    session.images.delete(imageId);
    
    return true;
  }

  /**
   * Get expired sessions
   */
  getExpiredSessions() {
    const now = Date.now();
    const expired = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        expired.push(sessionId);
      }
    }
    
    return expired;
  }

  /**
   * Get session info for client
   */
  getSessionInfo(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    return {
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      imageCount: session.images.size,
      memberCount: session.members.size,
      images: this.getSessionImages(sessionId)
    };
  }
}

// Singleton instance
const memoryStore = new MemoryStore();

export default memoryStore;

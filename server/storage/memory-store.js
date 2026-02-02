/**
 * In-Memory Storage Manager
 * Stores all session and file data in RAM only
 * No persistence - all data lost on server restart
 */

import { SESSION_CONFIG, FILE_CONFIG, MEMORY_CONFIG } from '../config/constants.js';

/**
 * Session structure:
 * {
 *   id: string,
 *   createdAt: number (timestamp),
 *   expiresAt: number (timestamp),
 *   files: Map<fileId, FileData>,
 *   members: Set<socketId>
 * }
 * 
 * FileData structure:
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
      fileCount: this.getTotalFileCount()
    };
  }

  /**
   * Get total file count across all sessions
   */
  getTotalFileCount() {
    let count = 0;
    for (const session of this.sessions.values()) {
      count += session.files.size;
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
      files: new Map(),
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

    // Free memory from all files
    for (const file of session.files.values()) {
      this.totalMemoryUsage -= file.size;
    }

    // Clear file map
    session.files.clear();
    
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
   * Add a file to a session
   */
  addFile(sessionId, fileId, fileData) {
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found or expired' };
    }

    // Check session file limit
    if (session.files.size >= SESSION_CONFIG.MAX_FILES_PER_SESSION) {
      return { success: false, error: 'Maximum files per session reached' };
    }

    // Check file size
    if (fileData.buffer.length > FILE_CONFIG.MAX_SIZE_BYTES) {
      return { success: false, error: 'File exceeds maximum size limit' };
    }

    // Check memory availability
    if (!this.hasAvailableMemory(fileData.buffer.length)) {
      return { success: false, error: 'Server memory limit reached' };
    }

    const file = {
      id: fileId,
      buffer: fileData.buffer,
      mimeType: fileData.mimeType,
      filename: fileData.filename || `file-${fileId}`,
      size: fileData.buffer.length,
      uploadedAt: Date.now(),
      uploadedBy: fileData.uploadedBy
    };

    session.files.set(fileId, file);
    this.totalMemoryUsage += file.size;

    return { 
      success: true, 
      file: {
        id: file.id,
        mimeType: file.mimeType,
        filename: file.filename,
        size: file.size,
        uploadedAt: file.uploadedAt
      }
    };
  }

  /**
   * Get file metadata (without buffer)
   */
  getFileMetadata(sessionId, fileId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const file = session.files.get(fileId);
    if (!file) return null;

    return {
      id: file.id,
      mimeType: file.mimeType,
      filename: file.filename,
      size: file.size,
      uploadedAt: file.uploadedAt
    };
  }

  /**
   * Get file with buffer (for download)
   */
  getFileWithBuffer(sessionId, fileId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    return session.files.get(fileId) || null;
  }

  /**
   * Get all file metadata for a session
   */
  getSessionFiles(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return [];

    return Array.from(session.files.values()).map(file => ({
      id: file.id,
      mimeType: file.mimeType,
      filename: file.filename,
      size: file.size,
      uploadedAt: file.uploadedAt
    }));
  }

  /**
   * Delete a file from a session
   */
  deleteFile(sessionId, fileId) {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const file = session.files.get(fileId);
    if (!file) return false;

    this.totalMemoryUsage -= file.size;
    session.files.delete(fileId);
    
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
      fileCount: session.files.size,
      memberCount: session.members.size,
      files: this.getSessionFiles(sessionId)
    };
  }
}

// Singleton instance
const memoryStore = new MemoryStore();

export default memoryStore;

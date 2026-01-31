/**
 * Session Service
 * Handles session lifecycle management
 */

import memoryStore from '../storage/memory-store.js';
import { generateSessionId } from '../utils/security.js';

class SessionService {
  /**
   * Create a new session
   */
  createSession() {
    const sessionId = generateSessionId();
    const session = memoryStore.createSession(sessionId);
    
    return {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt
    };
  }

  /**
   * Join an existing session
   */
  joinSession(sessionId, socketId) {
    const session = memoryStore.getSession(sessionId);
    
    if (!session) {
      return { success: false, error: 'Session not found or expired' };
    }

    memoryStore.addMember(sessionId, socketId);
    
    return {
      success: true,
      sessionInfo: memoryStore.getSessionInfo(sessionId)
    };
  }

  /**
   * Leave a session
   */
  leaveSession(socketId) {
    const sessionId = memoryStore.removeMember(socketId);
    return sessionId;
  }

  /**
   * Get session information
   */
  getSessionInfo(sessionId) {
    return memoryStore.getSessionInfo(sessionId);
  }

  /**
   * Check if session exists
   */
  isValidSession(sessionId) {
    return memoryStore.isValidSession(sessionId);
  }

  /**
   * Get session for a socket
   */
  getSocketSession(socketId) {
    return memoryStore.getSessionForSocket(socketId);
  }

  /**
   * Get all members in a session
   */
  getSessionMembers(sessionId) {
    const session = memoryStore.getSession(sessionId);
    if (!session) return [];
    return Array.from(session.members);
  }
}

const sessionService = new SessionService();
export default sessionService;

/**
 * Message Service (JavaScript version)
 * Handles CRUD operations for text messages in memory
 * All messages are session-scoped and auto-deleted on session expiry
 */

import { randomBytes } from 'crypto';
import { SESSION_CONFIG } from '../config/constants.js';
import memoryStore from '../storage/memory-store.js';

class MessageService {
  /**
   * Send a text message to a session
   */
  sendMessage(sessionId, content, senderId, senderName) {
    // Validate session exists
    const session = memoryStore.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    // Validate content
    if (!content || typeof content !== 'string') {
      throw new Error('Message content is required');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new Error('Message content cannot be empty');
    }


    // Check message limit
    const messageCount = session.messages?.length || 0;
    if (messageCount >= SESSION_CONFIG.MAX_MESSAGES_PER_SESSION) {
      throw new Error('Session has reached the maximum of 500 messages');
    }

    // Create message object
    const message = {
      id: this.generateMessageId(),
      content: trimmedContent,
      sentBy: senderId,
      sentByName: senderName || 'Anonymous',
      sentAt: new Date().toISOString(),
      sessionId: sessionId
    };

    // Add to session
    if (!session.messages) {
      session.messages = [];
    }
    session.messages.push(message);

    return message;
  }

  /**
   * Get all messages for a session
   */
  getMessages(sessionId) {
    const session = memoryStore.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    return session.messages || [];
  }

  /**
   * Delete a specific message
   */
  deleteMessage(sessionId, messageId) {
    const session = memoryStore.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    if (!session.messages) {
      throw new Error('Message not found');
    }

    const initialLength = session.messages.length;
    session.messages = session.messages.filter(m => m.id !== messageId);

    if (session.messages.length === initialLength) {
      throw new Error('Message not found');
    }

    return true;
  }

  /**
   * Delete all messages in a session (cleanup helper)
   */
  deleteAllMessages(sessionId) {
    const session = memoryStore.getSession(sessionId);
    if (!session) {
      return 0; // Session already deleted
    }

    const count = session.messages?.length || 0;
    if (session.messages) {
      session.messages = [];
    }

    return count;
  }

  /**
   * Get message count for a session
   */
  getMessageCount(sessionId) {
    const session = memoryStore.getSession(sessionId);
    if (!session) {
      return 0;
    }

    return session.messages?.length || 0;
  }

  /**
   * Check if a user can delete a message
   */
  canDeleteMessage(messageId, userId, sessionId) {
    const session = memoryStore.getSession(sessionId);
    if (!session) {
      return false;
    }

    const message = session.messages?.find(m => m.id === messageId);
    if (!message) {
      return false;
    }

    // User can delete their own messages or if they're the session creator
    return message.sentBy === userId || session.creatorId === userId;
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    const timestamp = Date.now();
    const randomHex = randomBytes(4).toString('hex');
    return `msg_${timestamp}_${randomHex}`;
  }
}

export default new MessageService();

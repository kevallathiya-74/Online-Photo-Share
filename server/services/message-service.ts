/**
 * Message Service
 * Handles CRUD operations for text messages in memory
 * All messages are session-scoped and auto-deleted on session expiry
 */

import { randomBytes } from 'crypto';
import type { TextMessage } from '../../shared/types.js';
import { ValidationError, NotFoundError } from '../../shared/types.js';
import { SESSION_CONFIG } from '../config/constants.js';

class MessageService {
  /**
   * Send a text message to a session
   */
  sendMessage(
    sessionId: string,
    content: string,
    senderId: string,
    senderName: string,
    sessions: Map<string, any>
  ): TextMessage {
    // Validate session exists
    const session = sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found or has expired');
    }

    // Validate message content
    if (!content || typeof content !== 'string') {
      throw new ValidationError('Message content is required');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new ValidationError('Message cannot be empty');
    }

    if (trimmedContent.length > 10000) {
      throw new ValidationError('Message is too long (maximum 10,000 characters)');
    }

    // Check message limit per session
    if (!session.messages) {
      session.messages = [];
    }

    if (session.messages.length >= SESSION_CONFIG.MAX_MESSAGES_PER_SESSION) {
      throw new ValidationError(
        `Session has reached the maximum of ${SESSION_CONFIG.MAX_MESSAGES_PER_SESSION} messages`
      );
    }

    // Create message
    const message: TextMessage = {
      id: this.generateMessageId(),
      content: trimmedContent,
      sentBy: senderId,
      sentByName: senderName || 'Anonymous',
      sentAt: Date.now(),
      sessionId
    };

    // Add to session
    session.messages.push(message);

    return message;
  }

  /**
   * Get all messages for a session
   */
  getMessages(sessionId: string, sessions: Map<string, any>): TextMessage[] {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found or has expired');
    }

    return session.messages || [];
  }

  /**
   * Delete a specific message
   */
  deleteMessage(
    sessionId: string,
    messageId: string,
    sessions: Map<string, any>
  ): void {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found or has expired');
    }

    if (!session.messages) {
      throw new NotFoundError('Message not found');
    }

    const index = session.messages.findIndex((m: TextMessage) => m.id === messageId);
    if (index === -1) {
      throw new NotFoundError('Message not found');
    }

    session.messages.splice(index, 1);
  }

  /**
   * Delete all messages for a session (called during cleanup)
   */
  deleteAllMessages(sessionId: string, sessions: Map<string, any>): number {
    const session = sessions.get(sessionId);
    if (!session || !session.messages) {
      return 0;
    }

    const count = session.messages.length;
    session.messages = [];
    return count;
  }

  /**
   * Get message count for a session
   */
  getMessageCount(sessionId: string, sessions: Map<string, any>): number {
    const session = sessions.get(sessionId);
    if (!session || !session.messages) {
      return 0;
    }

    return session.messages.length;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Validate message ownership (for delete operations)
   */
  canDeleteMessage(
    messageId: string,
    userId: string,
    sessionId: string,
    sessions: Map<string, any>
  ): boolean {
    const session = sessions.get(sessionId);
    if (!session || !session.messages) {
      return false;
    }

    const message = session.messages.find((m: TextMessage) => m.id === messageId);
    if (!message) {
      return false;
    }

    // User can delete their own messages or if they're the session creator
    return message.sentBy === userId || session.creatorId === userId;
  }
}

export default new MessageService();

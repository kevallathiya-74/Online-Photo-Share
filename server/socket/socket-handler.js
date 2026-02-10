/**
 * Socket.IO Event Handlers
 * Manages all WebSocket communication for real-time file sharing
 */

import { SOCKET_EVENTS } from '../config/constants.js';
import sessionService from '../services/session-service.js';
import fileService from '../services/file-service.js';
import chunkService from '../services/chunk-service.js';
import messageService from '../services/message-service.js';
import analyticsService from '../services/analytics-service.js';
import imageOptimizationService from '../services/image-optimization-service.js';
import memoryStore from '../storage/memory-store.js';
import { isValidSessionIdFormat, isValidFileIdFormat } from '../utils/security.js';

/**
 * Initialize Socket.IO handlers
 */
export function initializeSocketHandlers(io) {
  // Track connection counts for monitoring
  let connectionCount = 0;

  io.on('connection', (socket) => {
    connectionCount++;

    // Track active connections
    analyticsService.trackConnection(connectionCount);

    // Only log connections in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Socket] Client connected: ${socket.id}`);
    }

    // Create Session
    socket.on(SOCKET_EVENTS.CREATE_SESSION, (data, callback) => {
      // Handle case where data might be the callback (no data sent)
      if (typeof data === 'function') {
        callback = data;
        data = {};
      }

      try {
        const result = sessionService.createSession();

        // Track session creation
        analyticsService.trackSessionCreated();

        // Join the socket to the session room
        socket.join(result.sessionId);
        sessionService.joinSession(result.sessionId, socket.id);

        // Only log in development or with abbreviated ID
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Socket] Session created: ${result.sessionId}`);
        }

        if (typeof callback === 'function') {
          callback({ success: true, ...result });
        }

        socket.emit(SOCKET_EVENTS.SESSION_CREATED, result);
      } catch (error) {
        console.error('[Socket] Error creating session:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to create session' });
        }
      }
    });

    // Join Session
    socket.on(SOCKET_EVENTS.JOIN_SESSION, (data, callback) => {
      try {
        let { sessionId } = data || {};

        // Uppercase session ID for consistency
        if (sessionId) {
          sessionId = sessionId.toUpperCase();
        }

        // Validate session ID format
        if (!isValidSessionIdFormat(sessionId)) {
          const error = { success: false, error: 'Invalid session ID format' };
          if (typeof callback === 'function') callback(error);
          socket.emit(SOCKET_EVENTS.SESSION_ERROR, error);
          return;
        }

        const result = sessionService.joinSession(sessionId, socket.id);

        if (!result.success) {
          if (typeof callback === 'function') callback(result);
          socket.emit(SOCKET_EVENTS.SESSION_ERROR, result);
          return;
        }

        // Join the socket room
        socket.join(sessionId);

        console.log(`[Socket] Client ${socket.id} joined session: ${sessionId}`);

        if (typeof callback === 'function') {
          callback({ success: true, ...result.sessionInfo });
        }

        socket.emit(SOCKET_EVENTS.SESSION_JOINED, result.sessionInfo);

        // Notify other members
        socket.to(sessionId).emit(SOCKET_EVENTS.MEMBER_JOINED, {
          memberCount: result.sessionInfo.memberCount
        });
      } catch (error) {
        console.error('[Socket] Error joining session:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to join session' });
        }
      }
    });

    // Leave Session
    socket.on(SOCKET_EVENTS.LEAVE_SESSION, (data, callback) => {
      // Handle case where data might be the callback (no data sent)
      if (typeof data === 'function') {
        callback = data;
      }
      handleLeaveSession(socket, callback);
    });

    // Upload File (Binary data transfer with chunking support)
    socket.on(SOCKET_EVENTS.UPLOAD_FILE, async (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);

        if (!sessionId) {
          const error = {
            success: false,
            error: 'You must join a session before uploading files. Please create or join a session first.'
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Validate session is still active
        if (!sessionService.isValidSession(sessionId)) {
          const error = {
            success: false,
            error: 'Your session has expired. Please create a new session to continue.'
          };
          if (typeof callback === 'function') callback(error);
          socket.emit(SOCKET_EVENTS.SESSION_EXPIRED, { reason: 'Session expired during upload' });
          return;
        }

        // Data should contain: buffer (ArrayBuffer), mimeType, filename, size
        const { buffer, mimeType, filename, size } = data || {};

        if (!buffer) {
          const error = {
            success: false,
            error: 'No file data received. Please try uploading again.'
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Validate file size
        const fileSize = size || buffer.byteLength || buffer.length;
        if (fileSize > 100 * 1024 * 1024) {
          const error = {
            success: false,
            error: `This file is ${(fileSize / 1024 / 1024).toFixed(1)}MB, which exceeds the 100MB limit. Please choose a smaller file.`
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Convert ArrayBuffer to Buffer if needed
        let fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

        // Optimize images if applicable
        const fileMimeType = mimeType || 'application/octet-stream';
        if (imageOptimizationService.shouldOptimize(fileMimeType, fileBuffer.length)) {
          const optimized = await imageOptimizationService.optimizeImage(fileBuffer, fileMimeType);
          if (!optimized.error) {
            fileBuffer = optimized.buffer;
            console.log(`[ImageOptimization] Reduced size by ${optimized.savingsPercent}%`);
          }
        }

        const result = fileService.uploadFile(sessionId, fileBuffer, {
          mimeType: fileMimeType,
          filename: filename || 'unnamed-file'
        }, socket.id);

        // Track file upload
        analyticsService.trackFileUpload(fileMimeType, fileBuffer.length);

        if (!result.success) {
          // Provide user-friendly error messages
          let friendlyError = result.error;
          if (result.error.includes('memory')) {
            friendlyError = 'Server memory is full. Please try again in a few minutes or create a new session.';
          } else if (result.error.includes('maximum')) {
            friendlyError = `This session has reached its maximum capacity. Please create a new session to continue sharing.`;
          }

          const error = { success: false, error: friendlyError };
          if (typeof callback === 'function') callback(error);
          socket.emit(SOCKET_EVENTS.FILE_ERROR, error);
          return;
        }

        console.log(`[Socket] File uploaded: ${result.file.filename} (${(fileSize / 1024).toFixed(1)}KB) to session ${sessionId.substring(0, 8)}...`);

        if (typeof callback === 'function') {
          callback({ success: true, file: result.file });
        }

        // Broadcast to all clients in the session (including sender)
        io.to(sessionId).emit(SOCKET_EVENTS.FILE_ADDED, {
          file: result.file
        });
      } catch (error) {
        console.error('[Socket] Error uploading file:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to upload file' });
        }
      }
    });

    // Upload Start (Chunked Upload)
    socket.on(SOCKET_EVENTS.UPLOAD_START, (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);

        if (!sessionId) {
          const error = {
            success: false,
            error: 'You must join a session before uploading files.'
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Validate session is still active
        if (!sessionService.isValidSession(sessionId)) {
          const error = {
            success: false,
            error: 'Your session has expired. Please create a new session.'
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Data should contain: filename, mimeType, size, totalChunks
        const { filename, mimeType, size, totalChunks } = data || {};

        if (!filename || !size || !totalChunks) {
          const error = {
            success: false,
            error: 'Missing required upload information.'
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Validate file size
        if (size > 100 * 1024 * 1024) {
          const error = {
            success: false,
            error: `This file is ${(size / 1024 / 1024).toFixed(1)}MB, which exceeds the 100MB limit.`
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const result = chunkService.startUpload(sessionId, {
          filename,
          mimeType: mimeType || 'application/octet-stream',
          size,
          totalChunks
        });

        if (!result.success) {
          const error = { success: false, error: result.error };
          if (typeof callback === 'function') callback(error);
          return;
        }

        console.log(`[Socket] Chunked upload started: ${filename} (${(size / 1024).toFixed(1)}KB, ${totalChunks} chunks) to session ${sessionId.substring(0, 8)}...`);

        if (typeof callback === 'function') {
          callback({ success: true, uploadId: result.uploadId });
        }
      } catch (error) {
        console.error('[Socket] Error starting chunked upload:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to start upload. Please try again.' });
        }
      }
    });

    // Upload Chunk (Chunked Upload)
    socket.on(SOCKET_EVENTS.UPLOAD_CHUNK, (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);

        if (!sessionId) {
          const error = { success: false, error: 'You must join a session before uploading.' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Data should contain: uploadId, chunkIndex, chunkData
        const { uploadId, chunkIndex, chunkData } = data || {};

        if (!uploadId || chunkIndex === undefined || !chunkData) {
          const error = { success: false, error: 'Invalid chunk data.' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Convert ArrayBuffer to Buffer if needed
        const chunkBuffer = Buffer.isBuffer(chunkData) ? chunkData : Buffer.from(chunkData);

        const result = chunkService.processChunk(uploadId, chunkIndex, chunkBuffer);

        if (!result.success) {
          const error = { success: false, error: result.error };
          if (typeof callback === 'function') callback(error);
          return;
        }

        if (typeof callback === 'function') {
          callback({
            success: true,
            receivedChunks: result.receivedChunks,
            totalChunks: result.totalChunks,
            isComplete: result.isComplete
          });
        }

        // Emit progress update to all session members
        socket.emit(SOCKET_EVENTS.CHUNK_RECEIVED, {
          uploadId,
          chunkIndex,
          receivedChunks: result.receivedChunks,
          totalChunks: result.totalChunks,
          progress: Math.round((result.receivedChunks / result.totalChunks) * 100)
        });

      } catch (error) {
        console.error('[Socket] Error processing chunk:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to process chunk. Please try again.' });
        }
      }
    });

    // Upload Complete (Chunked Upload)
    socket.on(SOCKET_EVENTS.UPLOAD_COMPLETE, (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);

        if (!sessionId) {
          const error = { success: false, error: 'You must join a session.' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const { uploadId } = data || {};

        if (!uploadId) {
          const error = { success: false, error: 'Missing upload ID.' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Assemble chunks into complete file
        const assembleResult = chunkService.assembleFile(uploadId);

        if (!assembleResult.success) {
          const error = { success: false, error: assembleResult.error };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Upload assembled file to file service
        const uploadResult = fileService.uploadFile(
          sessionId,
          assembleResult.buffer,
          assembleResult.metadata,
          socket.id
        );

        if (!uploadResult.success) {
          const error = { success: false, error: uploadResult.error };
          if (typeof callback === 'function') callback(error);
          return;
        }

        console.log(`[Socket] Chunked upload completed: ${uploadResult.file.filename} to session ${sessionId.substring(0, 8)}...`);

        if (typeof callback === 'function') {
          callback({ success: true, file: uploadResult.file });
        }

        // Broadcast to all clients in the session
        io.to(sessionId).emit(SOCKET_EVENTS.FILE_ADDED, {
          file: uploadResult.file
        });

      } catch (error) {
        console.error('[Socket] Error completing chunked upload:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to complete upload. Please try again.' });
        }
      }
    });

    // Request File Data (for download/preview)
    socket.on(SOCKET_EVENTS.REQUEST_FILE, (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);

        if (!sessionId) {
          const error = { success: false, error: 'Not in a session' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const { fileId } = data || {};

        if (!isValidFileIdFormat(fileId)) {
          const error = { success: false, error: 'Invalid file ID' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const file = fileService.getFile(sessionId, fileId);

        if (!file) {
          const error = { success: false, error: 'File not found' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Track file download
        analyticsService.trackFileDownload();

        // Send file data back
        if (typeof callback === 'function') {
          callback({
            success: true,
            file: {
              id: file.id,
              buffer: file.buffer,
              mimeType: file.mimeType,
              filename: file.filename,
              size: file.size
            }
          });
        }

        // Also emit as event for clients that don't use callback
        socket.emit(SOCKET_EVENTS.FILE_DATA, {
          id: file.id,
          buffer: file.buffer,
          mimeType: file.mimeType,
          filename: file.filename,
          size: file.size
        });
      } catch (error) {
        console.error('[Socket] Error requesting file:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to retrieve file' });
        }
      }
    });

    // Delete File
    socket.on(SOCKET_EVENTS.DELETE_FILE, (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);

        if (!sessionId) {
          const error = { success: false, error: 'Not in a session' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const { fileId } = data || {};

        if (!isValidFileIdFormat(fileId)) {
          const error = { success: false, error: 'Invalid file ID' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const deleted = fileService.deleteFile(sessionId, fileId);

        if (!deleted) {
          const error = { success: false, error: 'File not found' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        console.log(`[Socket] File deleted: ${fileId.substring(0, 8)}...`);

        if (typeof callback === 'function') {
          callback({ success: true });
        }

        // Notify all clients in the session
        io.to(sessionId).emit(SOCKET_EVENTS.FILE_DELETED, { fileId });
      } catch (error) {
        console.error('[Socket] Error deleting file:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to delete file' });
        }
      }
    });

    // Send Message
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);

        if (!sessionId) {
          const error = {
            success: false,
            error: 'You must join a session before sending messages'
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const { content } = data || {};

        // Get session directly from memory store to access members
        const session = memoryStore.getSession(sessionId);
        if (!session) {
          const error = { success: false, error: 'Session not found' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Find sender name from session members
        let senderName = 'Anonymous';
        for (const [memberId, member] of session.members) {
          if (member.socketId === socket.id) {
            senderName = member.name;
            break;
          }
        }

        const message = messageService.sendMessage(
          sessionId,
          content,
          socket.id,
          senderName
        );

        // Track message
        analyticsService.trackMessage();

        console.log(`[Socket] Message sent in session ${sessionId.substring(0, 8)}... by ${senderName}`);

        if (typeof callback === 'function') {
          callback({ success: true, message });
        }

        // Broadcast to all clients in the session (including sender)
        io.to(sessionId).emit(SOCKET_EVENTS.MESSAGE_ADDED, { message });
      } catch (error) {
        console.error('[Socket] Error sending message:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    // Delete Message
    socket.on(SOCKET_EVENTS.DELETE_MESSAGE, async (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);

        if (!sessionId) {
          const error = {
            success: false,
            error: 'You must join a session before deleting messages'
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const { messageId } = data || {};

        if (!messageId) {
          const error = { success: false, error: 'Message ID is required' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Check if user can delete the message
        if (!messageService.canDeleteMessage(messageId, socket.id, sessionId)) {
          const error = {
            success: false,
            error: 'You can only delete your own messages'
          };
          if (typeof callback === 'function') callback(error);
          return;
        }

        messageService.deleteMessage(sessionId, messageId);

        console.log(`[Socket] Message deleted: ${messageId} from session ${sessionId.substring(0, 8)}...`);

        if (typeof callback === 'function') {
          callback({ success: true });
        }

        // Notify all clients in the session
        io.to(sessionId).emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId });
      } catch (error) {
        console.error('[Socket] Error deleting message:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: error.message });
        }
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      // Only log problematic disconnects in production
      if (process.env.NODE_ENV !== 'production' ||
        (reason !== 'client namespace disconnect' && reason !== 'transport close')) {
        // Log unexpected disconnects (ping timeout, transport error)
        if (reason === 'ping timeout' || reason === 'transport error') {
          console.warn(`[Socket] Client ${socket.id.substring(0, 8)} disconnect: ${reason}`);
        }
      }
      handleLeaveSession(socket);
    });
  });

  /**
   * Handle leaving session (both manual and disconnect)
   */
  function handleLeaveSession(socket, callback) {
    const sessionId = sessionService.leaveSession(socket.id);

    if (sessionId) {
      socket.leave(sessionId);

      const sessionInfo = sessionService.getSessionInfo(sessionId);

      if (sessionInfo) {
        // Notify remaining members
        socket.to(sessionId).emit(SOCKET_EVENTS.MEMBER_LEFT, {
          memberCount: sessionInfo.memberCount
        });
      }

      // Only log in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Socket] Client ${socket.id} left session: ${sessionId.substring(0, 8)}...`);
      }
    }

    if (typeof callback === 'function') {
      callback({ success: true });
    }
  }
}

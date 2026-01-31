/**
 * Socket.IO Event Handlers
 * Manages all WebSocket communication for real-time image sharing
 */

import { SOCKET_EVENTS } from '../config/constants.js';
import sessionService from '../services/session-service.js';
import imageService from '../services/image-service.js';
import { isValidSessionIdFormat, isValidImageIdFormat } from '../utils/security.js';

/**
 * Initialize Socket.IO handlers
 */
export function initializeSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Create Session
    socket.on(SOCKET_EVENTS.CREATE_SESSION, (data, callback) => {
      // Handle case where data might be the callback (no data sent)
      if (typeof data === 'function') {
        callback = data;
        data = {};
      }
      
      try {
        const result = sessionService.createSession();
        
        // Join the socket to the session room
        socket.join(result.sessionId);
        sessionService.joinSession(result.sessionId, socket.id);
        
        console.log(`[Socket] Session created: ${result.sessionId.substring(0, 8)}...`);
        
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

    // Upload Image (Binary data transfer)
    socket.on(SOCKET_EVENTS.UPLOAD_IMAGE, (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);
        
        if (!sessionId) {
          const error = { success: false, error: 'Not in a session' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Data should contain: buffer (ArrayBuffer), mimeType, filename
        const { buffer, mimeType, filename } = data || {};
        
        if (!buffer) {
          const error = { success: false, error: 'No image data provided' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Convert ArrayBuffer to Buffer if needed
        const imageBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

        const result = imageService.uploadImage(sessionId, imageBuffer, {
          mimeType,
          filename
        }, socket.id);

        if (!result.success) {
          if (typeof callback === 'function') callback(result);
          socket.emit(SOCKET_EVENTS.IMAGE_ERROR, result);
          return;
        }

        console.log(`[Socket] Image uploaded: ${result.image.id.substring(0, 8)}... to session ${sessionId.substring(0, 8)}...`);
        
        if (typeof callback === 'function') {
          callback({ success: true, image: result.image });
        }

        // Broadcast to all clients in the session (including sender)
        io.to(sessionId).emit(SOCKET_EVENTS.IMAGE_ADDED, {
          image: result.image
        });
      } catch (error) {
        console.error('[Socket] Error uploading image:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to upload image' });
        }
      }
    });

    // Request Image Data (for download/preview)
    socket.on(SOCKET_EVENTS.REQUEST_IMAGE, (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);
        
        if (!sessionId) {
          const error = { success: false, error: 'Not in a session' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const { imageId } = data || {};
        
        if (!isValidImageIdFormat(imageId)) {
          const error = { success: false, error: 'Invalid image ID' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const image = imageService.getImage(sessionId, imageId);
        
        if (!image) {
          const error = { success: false, error: 'Image not found' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        // Send image data back
        if (typeof callback === 'function') {
          callback({
            success: true,
            image: {
              id: image.id,
              buffer: image.buffer,
              mimeType: image.mimeType,
              filename: image.filename,
              size: image.size
            }
          });
        }

        // Also emit as event for clients that don't use callback
        socket.emit(SOCKET_EVENTS.IMAGE_DATA, {
          id: image.id,
          buffer: image.buffer,
          mimeType: image.mimeType,
          filename: image.filename,
          size: image.size
        });
      } catch (error) {
        console.error('[Socket] Error requesting image:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to retrieve image' });
        }
      }
    });

    // Delete Image
    socket.on(SOCKET_EVENTS.DELETE_IMAGE, (data, callback) => {
      try {
        const sessionId = sessionService.getSocketSession(socket.id);
        
        if (!sessionId) {
          const error = { success: false, error: 'Not in a session' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const { imageId } = data || {};
        
        if (!isValidImageIdFormat(imageId)) {
          const error = { success: false, error: 'Invalid image ID' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        const deleted = imageService.deleteImage(sessionId, imageId);
        
        if (!deleted) {
          const error = { success: false, error: 'Image not found' };
          if (typeof callback === 'function') callback(error);
          return;
        }

        console.log(`[Socket] Image deleted: ${imageId.substring(0, 8)}...`);
        
        if (typeof callback === 'function') {
          callback({ success: true });
        }

        // Notify all clients in the session
        io.to(sessionId).emit(SOCKET_EVENTS.IMAGE_DELETED, { imageId });
      } catch (error) {
        console.error('[Socket] Error deleting image:', error);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Failed to delete image' });
        }
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id}, reason: ${reason}`);
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

      console.log(`[Socket] Client ${socket.id} left session: ${sessionId.substring(0, 8)}...`);
    }

    if (typeof callback === 'function') {
      callback({ success: true });
    }
  }
}

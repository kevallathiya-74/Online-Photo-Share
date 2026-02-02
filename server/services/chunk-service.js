/**
 * Chunk Upload Service
 * Handles chunked file upload assembly with backpressure
 */

import { randomBytes } from 'crypto';

class ChunkService {
  constructor() {
    // Store incomplete uploads: Map<uploadId, UploadState>
    this.uploads = new Map();
    
    // Maximum concurrent uploads per session
    this.maxConcurrentUploads = 5;
    
    // Cleanup interval (30 minutes for stale uploads)
    this.cleanupInterval = 30 * 60 * 1000;
    
    // Start cleanup task
    this.startCleanup();
  }

  /**
   * Start a new chunked upload
   * @param {string} sessionId - Session ID
   * @param {object} metadata - File metadata {filename, mimeType, size, totalChunks}
   * @returns {object} - {success, uploadId, error}
   */
  startUpload(sessionId, metadata) {
    try {
      // Validate session has capacity
      const sessionUploads = Array.from(this.uploads.values())
        .filter(u => u.sessionId === sessionId && !u.completed);
      
      if (sessionUploads.length >= this.maxConcurrentUploads) {
        return {
          success: false,
          error: 'Too many concurrent uploads. Please wait for current uploads to complete.'
        };
      }

      // Generate upload ID
      const uploadId = randomBytes(16).toString('hex');

      // Create upload state
      const uploadState = {
        uploadId,
        sessionId,
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        size: metadata.size,
        totalChunks: metadata.totalChunks,
        chunks: new Map(), // Map<chunkIndex, Buffer>
        receivedChunks: 0,
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        completed: false
      };

      this.uploads.set(uploadId, uploadState);

      return {
        success: true,
        uploadId
      };
    } catch (error) {
      console.error('Failed to start upload:', error);
      return {
        success: false,
        error: 'Failed to start upload. Please try again.'
      };
    }
  }

  /**
   * Process a file chunk
   * @param {string} uploadId - Upload ID
   * @param {number} chunkIndex - Chunk index (0-based)
   * @param {Buffer} chunkData - Chunk data buffer
   * @returns {object} - {success, receivedChunks, totalChunks, isComplete, error}
   */
  processChunk(uploadId, chunkIndex, chunkData) {
    try {
      const uploadState = this.uploads.get(uploadId);

      if (!uploadState) {
        return {
          success: false,
          error: 'Upload session not found. Please start a new upload.'
        };
      }

      if (uploadState.completed) {
        return {
          success: false,
          error: 'Upload already completed.'
        };
      }

      // Check if chunk already received (idempotency)
      if (uploadState.chunks.has(chunkIndex)) {
        return {
          success: true,
          receivedChunks: uploadState.receivedChunks,
          totalChunks: uploadState.totalChunks,
          isComplete: false,
          duplicate: true
        };
      }

      // Validate chunk index
      if (chunkIndex < 0 || chunkIndex >= uploadState.totalChunks) {
        return {
          success: false,
          error: `Invalid chunk index: ${chunkIndex}. Expected 0-${uploadState.totalChunks - 1}.`
        };
      }

      // Store chunk
      uploadState.chunks.set(chunkIndex, chunkData);
      uploadState.receivedChunks++;
      uploadState.lastActivityAt = Date.now();

      const isComplete = uploadState.receivedChunks === uploadState.totalChunks;

      return {
        success: true,
        receivedChunks: uploadState.receivedChunks,
        totalChunks: uploadState.totalChunks,
        isComplete
      };
    } catch (error) {
      console.error('Failed to process chunk:', error);
      return {
        success: false,
        error: 'Failed to process chunk. Please try again.'
      };
    }
  }

  /**
   * Assemble chunks into complete file
   * @param {string} uploadId - Upload ID
   * @returns {object} - {success, buffer, metadata, error}
   */
  assembleFile(uploadId) {
    try {
      const uploadState = this.uploads.get(uploadId);

      if (!uploadState) {
        return {
          success: false,
          error: 'Upload not found.'
        };
      }

      if (uploadState.receivedChunks !== uploadState.totalChunks) {
        return {
          success: false,
          error: `Upload incomplete. Received ${uploadState.receivedChunks}/${uploadState.totalChunks} chunks.`
        };
      }

      // Assemble chunks in order
      const chunks = [];
      for (let i = 0; i < uploadState.totalChunks; i++) {
        const chunk = uploadState.chunks.get(i);
        if (!chunk) {
          return {
            success: false,
            error: `Missing chunk ${i}.`
          };
        }
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      // Verify size
      if (buffer.length !== uploadState.size) {
        return {
          success: false,
          error: `File size mismatch. Expected ${uploadState.size} bytes, got ${buffer.length} bytes.`
        };
      }

      // Mark as completed
      uploadState.completed = true;
      uploadState.completedAt = Date.now();

      // Clean up chunks to free memory
      uploadState.chunks.clear();

      // Remove from active uploads after a short delay
      setTimeout(() => {
        this.uploads.delete(uploadId);
      }, 60000); // Keep for 1 minute for retries

      return {
        success: true,
        buffer,
        metadata: {
          filename: uploadState.filename,
          mimeType: uploadState.mimeType,
          size: uploadState.size
        }
      };
    } catch (error) {
      console.error('Failed to assemble file:', error);
      return {
        success: false,
        error: 'Failed to assemble file. Please try again.'
      };
    }
  }

  /**
   * Cancel an upload
   * @param {string} uploadId - Upload ID
   * @returns {boolean} - Success status
   */
  cancelUpload(uploadId) {
    const uploadState = this.uploads.get(uploadId);
    if (uploadState) {
      uploadState.chunks.clear();
      this.uploads.delete(uploadId);
      return true;
    }
    return false;
  }

  /**
   * Get upload progress
   * @param {string} uploadId - Upload ID
   * @returns {object|null} - Progress info or null
   */
  getProgress(uploadId) {
    const uploadState = this.uploads.get(uploadId);
    if (!uploadState) return null;

    return {
      uploadId: uploadState.uploadId,
      filename: uploadState.filename,
      receivedChunks: uploadState.receivedChunks,
      totalChunks: uploadState.totalChunks,
      completed: uploadState.completed,
      startedAt: uploadState.startedAt
    };
  }

  /**
   * Cleanup stale uploads
   */
  cleanup() {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [uploadId, uploadState] of this.uploads.entries()) {
      const age = now - uploadState.lastActivityAt;
      if (age > staleThreshold) {
        console.log(`Cleaning up stale upload: ${uploadId} (${uploadState.filename})`);
        uploadState.chunks.clear();
        this.uploads.delete(uploadId);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Get service stats
   */
  getStats() {
    const activeUploads = Array.from(this.uploads.values())
      .filter(u => !u.completed).length;
    
    const completedUploads = Array.from(this.uploads.values())
      .filter(u => u.completed).length;

    return {
      activeUploads,
      completedUploads,
      totalUploads: this.uploads.size
    };
  }
}

// Singleton instance
export default new ChunkService();

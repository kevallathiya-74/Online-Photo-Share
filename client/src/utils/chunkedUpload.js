/**
 * Chunked Upload Utility
 * Handles large file uploads with chunking, progress tracking, and retry logic
 */

import { FILE_CONFIG, SOCKET_EVENTS } from './constants';

/**
 * Upload a file using chunked upload
 * @param {File} file - File to upload
 * @param {object} socketInterface - Socket interface with emit and on methods
 * @param {function} onProgress - Progress callback (progress, status)
 * @returns {Promise<object>} - Upload result
 */
export async function uploadFileChunked(file, socketInterface, onProgress = () => {}) {
  const { emit } = socketInterface;
  
  try {
    const CHUNK_SIZE = FILE_CONFIG.CHUNK_SIZE;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Use chunked upload for files larger than 5MB
    const useChunkedUpload = file.size > 5 * 1024 * 1024;

    if (!useChunkedUpload) {
      // For small files, use direct upload
      return await uploadFileDirect(file, emit, onProgress);
    }

    onProgress(0, 'preparing');

    // Step 1: Start chunked upload
    const startResult = await emit(SOCKET_EVENTS.UPLOAD_START, {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      totalChunks
    });

    if (!startResult || !startResult.success) {
      throw new Error(startResult?.error || 'Failed to start upload');
    }

    const { uploadId } = startResult;
    
    onProgress(0, 'uploading');

    // Step 2: Upload chunks sequentially
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      // Read chunk as ArrayBuffer
      const chunkData = await chunk.arrayBuffer();

      // Upload chunk with retry logic
      let retries = 3;
      let chunkSuccess = false;

      while (retries > 0 && !chunkSuccess) {
        try {
          const chunkResult = await emit(SOCKET_EVENTS.UPLOAD_CHUNK, {
            uploadId,
            chunkIndex,
            chunkData
          });

          if (chunkResult && chunkResult.success) {
            chunkSuccess = true;
            
            // Calculate and report progress
            const progress = Math.round((chunkIndex + 1) / totalChunks * 100);
            onProgress(progress, 'uploading');
          } else {
            throw new Error(chunkResult?.error || 'Chunk upload failed');
          }
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw new Error(`Failed to upload chunk ${chunkIndex} after 3 attempts: ${error.message}`);
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    onProgress(95, 'finalizing');

    // Step 3: Complete upload and assemble file
    const completeResult = await emit(SOCKET_EVENTS.UPLOAD_COMPLETE, {
      uploadId
    });

    if (!completeResult || !completeResult.success) {
      throw new Error(completeResult?.error || 'Failed to complete upload');
    }

    onProgress(100, 'success');

    return {
      success: true,
      file: completeResult.file
    };

  } catch (error) {
    console.error('Chunked upload error:', error);
    onProgress(0, 'error');
    
    return {
      success: false,
      error: error.message || 'Failed to upload file. Please try again.'
    };
  }
}

/**
 * Upload a file directly (for small files)
 * @param {File} file - File to upload
 * @param {function} emit - Socket emit function
 * @param {function} onProgress - Progress callback (progress, status)
 * @returns {Promise<object>} - Upload result
 */
async function uploadFileDirect(file, emit, onProgress = () => {}) {
  try {
    onProgress(10, 'uploading');

    const buffer = await file.arrayBuffer();
    
    onProgress(50, 'uploading');

    const result = await emit(SOCKET_EVENTS.UPLOAD_FILE, {
      buffer,
      mimeType: file.type || 'application/octet-stream',
      filename: file.name,
      size: file.size
    });

    if (!result || !result.success) {
      throw new Error(result?.error || 'Upload failed');
    }

    onProgress(100, 'success');

    return {
      success: true,
      file: result.file
    };

  } catch (error) {
    console.error('Direct upload error:', error);
    onProgress(0, 'error');
    
    return {
      success: false,
      error: error.message || 'Failed to upload file. Please try again.'
    };
  }
}

/**
 * Calculate optimal chunk size based on file size
 * @param {number} fileSize - File size in bytes
 * @returns {number} - Optimal chunk size in bytes
 */
export function getOptimalChunkSize(fileSize) {
  const MIN_CHUNK_SIZE = 256 * 1024; // 256KB
  const MAX_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
  const DEFAULT_CHUNK_SIZE = FILE_CONFIG.CHUNK_SIZE;

  if (fileSize < 10 * 1024 * 1024) { // < 10MB
    return MIN_CHUNK_SIZE;
  } else if (fileSize > 50 * 1024 * 1024) { // > 50MB
    return MAX_CHUNK_SIZE;
  }
  
  return DEFAULT_CHUNK_SIZE;
}

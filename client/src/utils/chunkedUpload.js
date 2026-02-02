/**
 * Chunked Upload Utility
 * Handles large file uploads with chunking, progress tracking, and retry logic
 */

import { FILE_CONFIG, SOCKET_EVENTS } from './constants';

/**
 * Upload a file using chunked upload with parallel processing
 * @param {File} file - File to upload
 * @param {object} socketInterface - Socket interface with emit and on methods
 * @param {function} onProgress - Progress callback (progress, status)
 * @returns {Promise<object>} - Upload result
 */
export async function uploadFileChunked(file, socketInterface, onProgress = () => {}) {
  const { emit } = socketInterface;
  
  try {
    // Use optimal chunk size based on file size
    const CHUNK_SIZE = getOptimalChunkSize(file.size);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Use chunked upload for files larger than 3MB (reduced threshold)
    const useChunkedUpload = file.size > 3 * 1024 * 1024;

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

    // Step 2: Upload chunks in parallel batches
    const MAX_PARALLEL = FILE_CONFIG.MAX_PARALLEL_CHUNKS || 3;
    let completedChunks = 0;
    
    // Process chunks in parallel batches
    for (let i = 0; i < totalChunks; i += MAX_PARALLEL) {
      const batchPromises = [];
      const batchSize = Math.min(MAX_PARALLEL, totalChunks - i);
      
      // Create batch of parallel uploads
      for (let j = 0; j < batchSize; j++) {
        const chunkIndex = i + j;
        if (chunkIndex >= totalChunks) break;
        
        batchPromises.push(
          uploadChunkWithRetry(file, uploadId, chunkIndex, CHUNK_SIZE, emit)
        );
      }
      
      // Wait for all chunks in batch to complete
      await Promise.all(batchPromises);
      
      completedChunks += batchSize;
      const progress = Math.round((completedChunks / totalChunks) * 95);
      onProgress(progress, 'uploading');
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
 * Upload a single chunk with retry logic
 * @param {File} file - Original file
 * @param {string} uploadId - Upload ID
 * @param {number} chunkIndex - Chunk index
 * @param {number} chunkSize - Size of each chunk
 * @param {function} emit - Socket emit function
 * @returns {Promise<void>}
 */
async function uploadChunkWithRetry(file, uploadId, chunkIndex, chunkSize, emit) {
  const start = chunkIndex * chunkSize;
  const end = Math.min(start + chunkSize, file.size);
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
      } else {
        throw new Error(chunkResult?.error || 'Chunk upload failed');
      }
    } catch (error) {
      retries--;
      if (retries === 0) {
        throw new Error(`Failed to upload chunk ${chunkIndex} after 3 attempts: ${error.message}`);
      }
      // Shorter retry delay for faster recovery (300ms instead of 1000ms)
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
}

/**
 * Calculate optimal chunk size based on file size
 * @param {number} fileSize - File size in bytes
 * @returns {number} - Optimal chunk size in bytes
 */
export function getOptimalChunkSize(fileSize) {
  const MIN_CHUNK_SIZE = 512 * 1024; // 512KB for small files
  const MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB for very large files
  const DEFAULT_CHUNK_SIZE = FILE_CONFIG.CHUNK_SIZE; // 2MB

  if (fileSize < 5 * 1024 * 1024) { // < 5MB
    return MIN_CHUNK_SIZE;
  } else if (fileSize > 50 * 1024 * 1024) { // > 50MB
    return MAX_CHUNK_SIZE;
  }
  
  return DEFAULT_CHUNK_SIZE;
}

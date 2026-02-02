/**
 * File Service
 * Handles file upload, retrieval, and deletion for ANY file type
 * Supports images, videos, PDFs, documents, zips, and all other file types
 */

import memoryStore from '../storage/memory-store.js';
import { generateFileId, sanitizeFilename } from '../utils/security.js';
import { FILE_CONFIG } from '../config/constants.js';

class FileService {
  /**
   * Process and store an uploaded file (ANY type)
   */
  uploadFile(sessionId, fileBuffer, metadata, uploadedBy) {
    // Validate buffer
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      return { success: false, error: 'Invalid file data' };
    }

    // Check size
    if (fileBuffer.length > FILE_CONFIG.MAX_SIZE_BYTES) {
      return { success: false, error: `File exceeds maximum size of ${FILE_CONFIG.MAX_SIZE_BYTES / 1024 / 1024}MB` };
    }

    // Generate file ID
    const fileId = generateFileId();

    // Get MIME type from metadata (accept any type)
    const mimeType = metadata?.mimeType || 'application/octet-stream';

    // Sanitize filename
    const filename = sanitizeFilename(metadata?.filename) || `file-${fileId}${this.getExtension(mimeType)}`;

    // Store file
    const result = memoryStore.addFile(sessionId, fileId, {
      buffer: fileBuffer,
      mimeType,
      filename,
      uploadedBy
    });

    return result;
  }

  /**
   * Get file data for download
   */
  getFile(sessionId, fileId) {
    return memoryStore.getFileWithBuffer(sessionId, fileId);
  }

  /**
   * Get file metadata only
   */
  getFileMetadata(sessionId, fileId) {
    return memoryStore.getFileMetadata(sessionId, fileId);
  }

  /**
   * Get all files in a session
   */
  getSessionFiles(sessionId) {
    return memoryStore.getSessionFiles(sessionId);
  }

  /**
   * Delete a file
   */
  deleteFile(sessionId, fileId) {
    return memoryStore.deleteFile(sessionId, fileId);
  }

  /**
   * Get file extension from MIME type
   */
  getExtension(mimeType) {
    const extensions = {
      // Images
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/heic': '.heic',
      'image/heif': '.heif',
      
      // Videos
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      'video/x-matroska': '.mkv',
      
      // Documents
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/plain': '.txt',
      'text/csv': '.csv',
      
      // Archives
      'application/zip': '.zip',
      'application/x-rar-compressed': '.rar',
      'application/x-7z-compressed': '.7z',
      'application/x-tar': '.tar',
      'application/gzip': '.gz',
      
      // Audio
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/webm': '.weba',
      
      // Other
      'application/json': '.json',
      'application/xml': '.xml',
      'text/html': '.html',
      'text/css': '.css',
      'text/javascript': '.js',
      'application/octet-stream': '.bin'
    };
    return extensions[mimeType] || '';
  }
}

const fileService = new FileService();
export default fileService;

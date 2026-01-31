/**
 * Image Service
 * Handles image upload, retrieval, and deletion
 */

import memoryStore from '../storage/memory-store.js';
import { generateImageId, sanitizeFilename, detectMimeType, isValidImageMimeType } from '../utils/security.js';
import { IMAGE_CONFIG } from '../config/constants.js';

class ImageService {
  /**
   * Process and store an uploaded image
   */
  uploadImage(sessionId, imageBuffer, metadata, uploadedBy) {
    // Validate buffer
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      return { success: false, error: 'Invalid image data' };
    }

    // Check size
    if (imageBuffer.length > IMAGE_CONFIG.MAX_SIZE_BYTES) {
      return { success: false, error: `Image exceeds maximum size of ${IMAGE_CONFIG.MAX_SIZE_BYTES / 1024 / 1024}MB` };
    }

    // Detect and validate MIME type
    let mimeType = detectMimeType(imageBuffer);
    
    // Fallback to provided MIME type if detection fails
    if (!mimeType && metadata?.mimeType && isValidImageMimeType(metadata.mimeType)) {
      mimeType = metadata.mimeType;
    }

    if (!mimeType || !IMAGE_CONFIG.ALLOWED_TYPES.includes(mimeType)) {
      return { success: false, error: 'Invalid or unsupported image format' };
    }

    // Generate image ID
    const imageId = generateImageId();

    // Sanitize filename
    const filename = sanitizeFilename(metadata?.filename) || `image-${imageId}.${this.getExtension(mimeType)}`;

    // Store image
    const result = memoryStore.addImage(sessionId, imageId, {
      buffer: imageBuffer,
      mimeType,
      filename,
      uploadedBy
    });

    return result;
  }

  /**
   * Get image data for download
   */
  getImage(sessionId, imageId) {
    return memoryStore.getImageWithBuffer(sessionId, imageId);
  }

  /**
   * Get image metadata only
   */
  getImageMetadata(sessionId, imageId) {
    return memoryStore.getImageMetadata(sessionId, imageId);
  }

  /**
   * Get all images in a session
   */
  getSessionImages(sessionId) {
    return memoryStore.getSessionImages(sessionId);
  }

  /**
   * Delete an image
   */
  deleteImage(sessionId, imageId) {
    return memoryStore.deleteImage(sessionId, imageId);
  }

  /**
   * Get file extension from MIME type
   */
  getExtension(mimeType) {
    const extensions = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/heic': 'heic',
      'image/heif': 'heif'
    };
    return extensions[mimeType] || 'bin';
  }
}

const imageService = new ImageService();
export default imageService;

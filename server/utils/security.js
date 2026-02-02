/**
 * Security Utilities
 * Cryptographic functions for secure session and file IDs
 */

import crypto from 'crypto';
import { SESSION_CONFIG, FILE_CONFIG } from '../config/constants.js';

/**
 * Generate a cryptographically secure session ID
 * Uses crypto.randomBytes for unpredictable IDs
 */
export function generateSessionId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0,O,1,I
  let sessionId = '';
  const randomBytes = crypto.randomBytes(SESSION_CONFIG.ID_LENGTH);
  for (let i = 0; i < SESSION_CONFIG.ID_LENGTH; i++) {
    sessionId += chars[randomBytes[i] % chars.length];
  }
  return sessionId;
}

/**
 * Generate a secure file ID
 */
export function generateFileId() {
  return crypto.randomBytes(FILE_CONFIG.ID_LENGTH).toString('hex');
}

// Alias for backwards compatibility
export const generateImageId = generateFileId;

/**
 * Validate session ID format
 */
export function isValidSessionIdFormat(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') return false;
  
  // Session ID should be 5 alphanumeric characters (case-insensitive)
  const alphanumRegex = /^[A-Z2-9]{5}$/i;
  return alphanumRegex.test(sessionId);
}

/**
 * Validate file ID format
 */
export function isValidFileIdFormat(fileId) {
  if (!fileId || typeof fileId !== 'string') return false;
  
  // File ID should be 32 hex characters (16 bytes)
  const hexRegex = /^[a-f0-9]{32}$/i;
  return hexRegex.test(fileId);
}

// Alias for backwards compatibility
export const isValidImageIdFormat = isValidFileIdFormat;

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed';
  }
  
  // Remove path separators and null bytes
  return filename
    .replace(/[/\\]/g, '')
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .substring(0, 255); // Limit length
}

/**
 * Validate MIME type format (accepts any valid MIME type)
 */
export function isValidMimeType(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') return false;
  // Basic MIME type validation: type/subtype
  return /^[a-z]+\/[a-z0-9\-\+\.]+$/i.test(mimeType);
}

// Legacy alias - now accepts any MIME type
export const isValidImageMimeType = isValidMimeType;

/**
 * Extract MIME type from buffer magic bytes (images only)
 * For other file types, rely on metadata from client
 */
export function detectMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // Check magic bytes
  const header = buffer.slice(0, 12);
  
  // JPEG
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
    return 'image/gif';
  }
  
  // WebP
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
    return 'image/webp';
  }
  
  // BMP
  if (header[0] === 0x42 && header[1] === 0x4D) {
    return 'image/bmp';
  }

  return null;
}

/**
 * Generate a short share code from session ID
 */
export function generateShareCode(sessionId) {
  // Take first 8 characters for user-friendly sharing
  return sessionId.substring(0, 8).toUpperCase();
}

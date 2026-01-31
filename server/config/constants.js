/**
 * Server Configuration Constants
 * Centralized configuration for the image sharing server
 */

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0'
};

export const SESSION_CONFIG = {
  // Session TTL: 1 hour in milliseconds
  TTL_MS: 60 * 60 * 1000,
  // Session ID length in bytes (5 alphanumeric characters)
  ID_LENGTH: 5,
  // Maximum images per session
  MAX_IMAGES_PER_SESSION: 50,
  // Cleanup interval: run every 5 minutes
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000
};

export const IMAGE_CONFIG = {
  // Maximum image size: 5MB
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  // Allowed MIME types
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/heic',
    'image/heif'
  ],
  // Image ID length in bytes
  ID_LENGTH: 16
};

export const MEMORY_CONFIG = {
  // Maximum total memory usage (500MB)
  MAX_TOTAL_BYTES: 500 * 1024 * 1024,
  // Warning threshold (80%)
  WARNING_THRESHOLD: 0.8,
  // Critical threshold (95%)
  CRITICAL_THRESHOLD: 0.95
};

export const SOCKET_EVENTS = {
  // Client -> Server
  CREATE_SESSION: 'session:create',
  JOIN_SESSION: 'session:join',
  LEAVE_SESSION: 'session:leave',
  UPLOAD_IMAGE: 'image:upload',
  DELETE_IMAGE: 'image:delete',
  REQUEST_IMAGE: 'image:request',
  
  // Server -> Client
  SESSION_CREATED: 'session:created',
  SESSION_JOINED: 'session:joined',
  SESSION_LEFT: 'session:left',
  SESSION_ERROR: 'session:error',
  SESSION_EXPIRED: 'session:expired',
  IMAGE_ADDED: 'image:added',
  IMAGE_DELETED: 'image:deleted',
  IMAGE_DATA: 'image:data',
  IMAGE_ERROR: 'image:error',
  MEMBER_JOINED: 'member:joined',
  MEMBER_LEFT: 'member:left',
  SESSION_INFO: 'session:info'
};

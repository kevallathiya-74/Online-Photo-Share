/**
 * Server Configuration Constants
 * Centralized configuration for the image sharing server
 */

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0'
};

export const SESSION_CONFIG = {
  // Session TTL: 5 hours in milliseconds
  TTL_MS: 5 * 60 * 60 * 1000,
  // Session ID length in bytes (5 alphanumeric characters)
  ID_LENGTH: 5,
  // Maximum files per session
  MAX_FILES_PER_SESSION: 100,
  // Maximum text messages per session
  MAX_MESSAGES_PER_SESSION: 500,
  // Cleanup interval: run every 5 minutes
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000
};

export const FILE_CONFIG = {
  // Maximum file size: 100MB
  MAX_SIZE_BYTES: 100 * 1024 * 1024,
  // Accept ALL file types - no restrictions
  ALLOWED_TYPES: ['*'],
  // File ID length in bytes
  ID_LENGTH: 16,
  // Chunk size for large file uploads: 2MB for faster transfers
  CHUNK_SIZE: 2 * 1024 * 1024
};

// Deprecated: keeping for backwards compatibility
export const IMAGE_CONFIG = FILE_CONFIG;

export const MEMORY_CONFIG = {
  // Maximum total memory usage (2GB for 100MB files)
  MAX_TOTAL_BYTES: 2 * 1024 * 1024 * 1024,
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
  UPLOAD_FILE: 'file:upload',
  UPLOAD_START: 'file:upload-start',
  UPLOAD_CHUNK: 'file:upload-chunk',
  UPLOAD_COMPLETE: 'file:upload-complete',
  DELETE_FILE: 'file:delete',
  REQUEST_FILE: 'file:request',
  SEND_MESSAGE: 'message:send',
  DELETE_MESSAGE: 'message:delete',
  
  // Server -> Client
  SESSION_CREATED: 'session:created',
  SESSION_JOINED: 'session:joined',
  SESSION_LEFT: 'session:left',
  SESSION_ERROR: 'session:error',
  SESSION_EXPIRED: 'session:expired',
  FILE_ADDED: 'file:added',
  FILE_DELETED: 'file:deleted',
  FILE_DATA: 'file:data',
  FILE_ERROR: 'file:error',
  CHUNK_RECEIVED: 'file:chunk-received',
  UPLOAD_PROGRESS: 'file:upload-progress',
  MESSAGE_ADDED: 'message:added',
  MESSAGE_DELETED: 'message:deleted',
  MEMBER_JOINED: 'member:joined',
  MEMBER_LEFT: 'member:left',
  SESSION_INFO: 'session:info'
};

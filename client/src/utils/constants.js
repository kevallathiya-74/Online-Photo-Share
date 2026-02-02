/**
 * Socket event constants (mirrored from server)
 */
export const SOCKET_EVENTS = {
  // Client -> Server
  CREATE_SESSION: 'session:create',
  JOIN_SESSION: 'session:join',
  LEAVE_SESSION: 'session:leave',
  UPLOAD_FILE: 'file:upload',
  UPLOAD_CHUNK: 'file:upload-chunk',
  UPLOAD_START: 'file:upload-start',
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
  MEMBER_JOINED: 'member:joined',
  MEMBER_LEFT: 'member:left',
  SESSION_INFO: 'session:info',
  MESSAGE_ADDED: 'message:added',
  MESSAGE_DELETED: 'message:deleted'
};

/**
 * File configuration - supports ALL file types
 */
export const FILE_CONFIG = {
  MAX_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  ALLOWED_TYPES: ['*'], // Accept all file types
  CHUNK_SIZE: 2 * 1024 * 1024, // 2MB chunks for faster uploads
  MAX_PARALLEL_CHUNKS: 3 // Upload 3 chunks in parallel
};

// Legacy support
export const IMAGE_CONFIG = FILE_CONFIG;

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  TTL_MS: 5 * 60 * 60 * 1000, // 5 hours
  MAX_FILES: 100
};

/**
 * Socket event constants (mirrored from server)
 */
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

/**
 * Image configuration
 */
export const IMAGE_CONFIG = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/heic',
    'image/heif'
  ]
};

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  TTL_MS: 60 * 60 * 1000, // 1 hour
  MAX_IMAGES: 50
};

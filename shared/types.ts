/**
 * Shared Type Definitions
 * Used across frontend and backend for type safety
 */

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface Session {
  id: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  creatorName?: string;
  members: SessionMember[];
  files: FileMetadata[];
  messages: TextMessage[];
}

export interface SessionMember {
  id: string;
  name: string;
  joinedAt: number;
  socketId?: string;
}

export interface SessionInfo {
  id: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  memberCount: number;
  fileCount: number;
  messageCount: number;
}

// ============================================================================
// FILE TYPES
// ============================================================================

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
  uploadedBy: string;
}

export interface FileData extends FileMetadata {
  buffer: Buffer | ArrayBuffer;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number; // 0-100
  status: 'preparing' | 'uploading' | 'finalizing' | 'success' | 'error';
  error?: string;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface TextMessage {
  id: string;
  content: string;
  sentBy: string;
  sentByName: string;
  sentAt: number;
  sessionId: string;
}

export interface SendMessagePayload {
  sessionId: string;
  content: string;
  senderName?: string;
}

export interface DeleteMessagePayload {
  sessionId: string;
  messageId: string;
}

// ============================================================================
// SOCKET EVENT TYPES
// ============================================================================

export interface SocketEventMap {
  // Session events
  CREATE_SESSION: { creatorName: string };
  SESSION_CREATED: { session: Session };
  JOIN_SESSION: { code: string; userName: string };
  SESSION_JOINED: { session: Session };
  LEAVE_SESSION: { sessionId: string };
  SESSION_LEFT: { sessionId: string };
  USER_JOINED: { member: SessionMember };
  USER_LEFT: { memberId: string };
  SESSION_EXPIRED: { sessionId: string };

  // File events
  UPLOAD_FILE: {
    sessionId: string;
    fileName: string;
    fileData: ArrayBuffer | Buffer;
    fileType: string;
    fileSize: number;
  };
  UPLOAD_START: {
    sessionId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    totalChunks: number;
  };
  UPLOAD_STARTED: { uploadId: string };
  UPLOAD_CHUNK: {
    sessionId: string;
    uploadId: string;
    chunkIndex: number;
    chunkData: ArrayBuffer | Buffer;
    totalChunks: number;
  };
  CHUNK_RECEIVED: { chunkIndex: number; uploadId: string };
  UPLOAD_PROGRESS: {
    uploadId: string;
    progress: number;
    status: string;
  };
  UPLOAD_COMPLETE: {
    sessionId: string;
    uploadId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  };
  FILE_ADDED: { file: FileMetadata };
  REQUEST_FILE: { sessionId: string; fileId: string };
  FILE_DATA: { fileData: ArrayBuffer | Buffer; metadata: FileMetadata };
  DELETE_FILE: { sessionId: string; fileId: string };
  FILE_DELETED: { fileId: string };

  // Message events
  SEND_MESSAGE: SendMessagePayload;
  MESSAGE_ADDED: { message: TextMessage };
  DELETE_MESSAGE: DeleteMessagePayload;
  MESSAGE_DELETED: { messageId: string };

  // Error events
  error: { message: string; code?: string };
  connect: void;
  disconnect: void;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface FileConfig {
  MAX_SIZE_BYTES: number;
  CHUNK_SIZE: number;
}

export interface SessionConfig {
  TTL_MS: number;
  CODE_LENGTH: number;
  MAX_FILES_PER_SESSION: number;
  MAX_MESSAGES_PER_SESSION: number;
}

export interface MemoryConfig {
  MAX_TOTAL_BYTES: number;
  WARNING_THRESHOLD: number;
  CRITICAL_THRESHOLD: number;
}

export interface ServerConfig {
  PORT: number;
  HOST: string;
  NODE_ENV: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class MemoryError extends AppError {
  constructor(message: string) {
    super(message, 'MEMORY_ERROR', 507);
    this.name = 'MemoryError';
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type SocketCallback<T = any> = (response: { success: boolean; data?: T; error?: string }) => void;

export interface MemoryStats {
  totalBytes: number;
  maxBytes: number;
  usagePercent: number;
  sessionCount: number;
  fileCount: number;
  messageCount: number;
}

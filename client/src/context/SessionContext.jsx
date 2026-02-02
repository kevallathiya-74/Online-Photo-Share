import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { SOCKET_EVENTS } from '../utils/constants';
import { uploadFileChunked } from '../utils/chunkedUpload';

const SessionContext = createContext(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}

export function SessionProvider({ children }) {
  const { emit, on, isConnected } = useSocket();
  
  const [session, setSession] = useState(null);
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create a new session
  const createSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[Session] Creating session...');
      const result = await emit(SOCKET_EVENTS.CREATE_SESSION);
      console.log('[Session] Create result:', result);
      
      if (result && result.sessionId) {
        setSession({
          id: result.sessionId,
          createdAt: result.createdAt,
          expiresAt: result.expiresAt
        });
        setFiles([]);
        setMessages([]);
        setMemberCount(1);
        console.log('[Session] Session state updated:', result.sessionId);
      }
      return result;
    } catch (err) {
      console.error('[Session] Create error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [emit]);

  // Join an existing session
  const joinSession = useCallback(async (sessionId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await emit(SOCKET_EVENTS.JOIN_SESSION, { sessionId });
      setSession({
        id: result.id,
        createdAt: result.createdAt,
        expiresAt: result.expiresAt
      });
      setFiles(result.files || []);
      setMessages(result.messages || []);
      setMemberCount(result.memberCount || 1);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [emit]);

  // Leave current session
  const leaveSession = useCallback(async () => {
    console.log('[Session] Leaving session...');
    try {
      await emit(SOCKET_EVENTS.LEAVE_SESSION);
      console.log('[Session] Left session successfully');
    } catch (err) {
      console.error('[Session] Error leaving session:', err);
      // Still clear local state even if emit fails
    }
    // Always clear state
    setSession(null);
    setFiles([]);
    setMessages([]);
    setMemberCount(0);
  }, [emit]);

  // Send a message
  const sendMessage = useCallback(async (content) => {
    if (!session) {
      throw new Error('Not in a session');
    }

    try {
      const result = await emit(SOCKET_EVENTS.SEND_MESSAGE, { 
        sessionId: session.id, 
        content 
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [emit, session]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId) => {
    if (!session) {
      throw new Error('Not in a session');
    }

    try {
      const result = await emit(SOCKET_EVENTS.DELETE_MESSAGE, { 
        sessionId: session.id, 
        messageId 
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete message');
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [emit, session]);

  // Upload a file with chunking support
  const uploadFile = useCallback(async (file, onProgress) => {
    if (!session) {
      throw new Error('Not in a session');
    }

    setError(null);
    
    try {
      // Use chunked upload utility (auto-selects chunked vs direct)
      const result = await uploadFileChunked(file, { emit, on }, onProgress);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [emit, on, session]);

  // Request file data for download
  const requestFile = useCallback(async (fileId) => {
    if (!session) {
      throw new Error('Not in a session');
    }
    
    try {
      const result = await emit(SOCKET_EVENTS.REQUEST_FILE, { fileId });
      return result;
    } catch (err) {
      console.error('Error requesting file:', err);
      throw err;
    }
  }, [emit, session]);

  // Delete a file
  const deleteFile = useCallback(async (fileId) => {
    if (!session) {
      throw new Error('Not in a session');
    }
    
    try {
      await emit(SOCKET_EVENTS.DELETE_FILE, { fileId });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [emit, session]);

  // Listen for socket events
  useEffect(() => {
    if (!isConnected) return;

    const cleanups = [];

    // File added
    cleanups.push(on(SOCKET_EVENTS.FILE_ADDED, (data) => {
      setFiles(prev => [...prev, data.file]);
    }));

    // File deleted
    cleanups.push(on(SOCKET_EVENTS.FILE_DELETED, (data) => {
      setFiles(prev => prev.filter(f => f.id !== data.fileId));
    }));

    // Message added
    cleanups.push(on(SOCKET_EVENTS.MESSAGE_ADDED, (data) => {
      setMessages(prev => [...prev, data.message]);
    }));

    // Message deleted
    cleanups.push(on(SOCKET_EVENTS.MESSAGE_DELETED, (data) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    }));

    // Member joined
    cleanups.push(on(SOCKET_EVENTS.MEMBER_JOINED, (data) => {
      setMemberCount(data.memberCount);
    }));

    // Member left
    cleanups.push(on(SOCKET_EVENTS.MEMBER_LEFT, (data) => {
      setMemberCount(data.memberCount);
    }));

    // Session expired
    cleanups.push(on(SOCKET_EVENTS.SESSION_EXPIRED, () => {
      setSession(null);
      setFiles([]);
      setMessages([]);
      setMemberCount(0);
      setError('Session has expired');
    }));

    // Session error
    cleanups.push(on(SOCKET_EVENTS.SESSION_ERROR, (data) => {
      setError(data.error);
    }));

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [isConnected, on]);

  const value = {
    session,
    files,
    messages,
    memberCount,
    isLoading,
    error,
    createSession,
    joinSession,
    leaveSession,
    uploadFile,
    requestFile,
    deleteFile,
    sendMessage,
    deleteMessage,
    clearError: () => setError(null)
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

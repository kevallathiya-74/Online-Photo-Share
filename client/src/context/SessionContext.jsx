import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { SOCKET_EVENTS } from '../utils/constants';

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
  const [images, setImages] = useState([]);
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
        setImages([]);
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
      setImages(result.images || []);
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
    setImages([]);
    setMemberCount(0);
  }, [emit]);

  // Upload an image
  const uploadImage = useCallback(async (file) => {
    if (!session) {
      throw new Error('Not in a session');
    }

    setError(null);
    
    try {
      // Read file as ArrayBuffer
      const buffer = await file.arrayBuffer();
      
      const result = await emit(SOCKET_EVENTS.UPLOAD_IMAGE, {
        buffer: buffer,
        mimeType: file.type,
        filename: file.name
      });
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [emit, session]);

  // Request image data for download
  const requestImage = useCallback(async (imageId) => {
    if (!session) {
      throw new Error('Not in a session');
    }
    
    try {
      const result = await emit(SOCKET_EVENTS.REQUEST_IMAGE, { imageId });
      return result;
    } catch (err) {
      console.error('Error requesting image:', err);
      throw err;
    }
  }, [emit, session]);

  // Delete an image
  const deleteImage = useCallback(async (imageId) => {
    if (!session) {
      throw new Error('Not in a session');
    }
    
    try {
      await emit(SOCKET_EVENTS.DELETE_IMAGE, { imageId });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [emit, session]);

  // Listen for socket events
  useEffect(() => {
    if (!isConnected) return;

    const cleanups = [];

    // Image added
    cleanups.push(on(SOCKET_EVENTS.IMAGE_ADDED, (data) => {
      setImages(prev => [...prev, data.image]);
    }));

    // Image deleted
    cleanups.push(on(SOCKET_EVENTS.IMAGE_DELETED, (data) => {
      setImages(prev => prev.filter(img => img.id !== data.imageId));
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
      setImages([]);
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
    images,
    memberCount,
    isLoading,
    error,
    createSession,
    joinSession,
    leaveSession,
    uploadImage,
    requestImage,
    deleteImage,
    clearError: () => setError(null)
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

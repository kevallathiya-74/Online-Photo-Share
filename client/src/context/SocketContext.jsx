import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    // Create socket connection - use same hostname but port 3000 for backend
    const socketUrl = import.meta.env.DEV 
      ? `http://${window.location.hostname}:3000`
      : window.location.origin;
    
    console.log('[Socket] Connecting to:', socketUrl);
    
    const socketInstance = io(socketUrl, {
      // Transport settings - prefer websocket for better performance
      transports: ['websocket', 'polling'], // Try websocket first
      upgrade: true,
      rememberUpgrade: true, // Remember successful transport upgrade
      
      // Reconnection strategy - exponential backoff
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying to reconnect
      reconnectionDelay: 1000, // Start with 1 second
      reconnectionDelayMax: 10000, // Max 10 seconds between attempts
      randomizationFactor: 0.5, // Randomize to prevent thundering herd
      
      // Timeout settings - longer for production deployment
      timeout: 45000, // 45 seconds connection timeout
      
      // Automatically connect
      autoConnect: true,
      
      // Query parameters for debugging
      query: {
        clientType: 'web',
        version: '1.0'
      }
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected:', socketInstance.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
      
      // Log specific disconnect reasons for debugging
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, reconnect manually
        console.log('[Socket] Server disconnected, attempting reconnect...');
        socketInstance.connect();
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        console.log('[Socket] Connection lost, auto-reconnecting...');
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    });
    
    // Reconnection attempt tracking
    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[Socket] Reconnection attempt ${attemptNumber}...`);
    });
    
    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setConnectionError(null);
    });
    
    socketInstance.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed');
      setConnectionError('Unable to connect to server. Please check your internet connection.');
    });
    
    // Heartbeat - keep connection alive
    socketInstance.on('ping', () => {
      // Server sent ping, respond with pong automatically
    });
    
    socketInstance.on('pong', (latency) => {
      // Connection is alive, latency in ms
      if (latency > 1000) {
        console.warn(`[Socket] High latency: ${latency}ms`);
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const emit = useCallback((event, data) => {
    return new Promise((resolve, reject) => {
      if (!socket || !isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Add timeout to prevent hanging requests
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout - server did not respond'));
      }, 30000); // 30 second timeout

      socket.emit(event, data, (response) => {
        clearTimeout(timeout);
        
        if (response?.success === false) {
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [socket, isConnected]);

  const on = useCallback((event, handler) => {
    if (!socket) return () => {};
    
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket]);

  const off = useCallback((event, handler) => {
    if (!socket) return;
    socket.off(event, handler);
  }, [socket]);

  const value = {
    socket,
    isConnected,
    connectionError,
    emit,
    on,
    off
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

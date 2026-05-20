import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../api';

let socketInstance = null;

export const useSocket = (userId) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    try {
      if (!socketInstance || !socketInstance.connected) {
        socketInstance = io(API_BASE, {
          transports: ['websocket'],
          autoConnect: true,
          reconnection: true,
          reconnectionDelay: 2000,
          reconnectionAttempts: 3,
          timeout: 10000,
        });

        socketInstance.on('connect_error', (err) => {
          console.warn('Socket connect error (non-fatal):', err.message);
        });
      }

      socketRef.current = socketInstance;
      socketInstance.emit('join-user', userId);
    } catch (e) {
      console.warn('Socket init failed (non-fatal):', e.message);
    }

    return () => {
      // Don't disconnect — persist across pages
    };
  }, [userId]);

  const on = useCallback((event, handler) => {
    try { socketRef.current?.on(event, handler); } catch(e) {}
  }, []);

  const off = useCallback((event, handler) => {
    try { socketRef.current?.off(event, handler); } catch(e) {}
  }, []);

  const emit = useCallback((event, data) => {
    try { socketRef.current?.emit(event, data); } catch(e) {}
  }, []);

  return { on, off, emit, socket: socketRef.current };
};

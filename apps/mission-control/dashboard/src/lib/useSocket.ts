import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { wsUrl } from './config';

let globalSocket: Socket | null = null;

function getSocket(): Socket | null {
  return globalSocket;
}

function connectSocket(token: string | null): Socket | null {
  if (!token) return null;
  if (globalSocket?.connected) return globalSocket;

  if (globalSocket) {
    globalSocket.disconnect();
  }

  globalSocket = io(wsUrl(), {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
  });

  globalSocket.on('connect', () => {
    console.log('ws: connected');
  });

  globalSocket.on('disconnect', (reason) => {
    console.log('ws: disconnected', reason);
  });

  globalSocket.on('connect_error', (err) => {
    console.warn('ws: connection error', err.message);
  });

  return globalSocket;
}

function disconnectSocket() {
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
}

function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('session');
    socketRef.current = connectSocket(token);

    return () => {
      // Don't disconnect on unmount — keep alive across pages
    };
  }, []);

  const subscribe = useCallback((channel: string) => {
    const s = socketRef.current || getSocket();
    if (s) s.emit('subscribe', channel);
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    const s = socketRef.current || getSocket();
    if (s) s.emit('unsubscribe', channel);
  }, []);

  const onEvent = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const s = socketRef.current || getSocket();
    if (s) {
      s.on(event, handler);
      return () => { s.off(event, handler); };
    }
    return () => {};
  }, []);

  return { socket: socketRef, subscribe, unsubscribe, onEvent };
}

export { useSocket, connectSocket, disconnectSocket, getSocket };

import { Server as SocketIOServer } from 'socket.io';
import { eventBus } from '@hhs/event-bus';

let io = null;

export function initWebSocket(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    socket.data.sessionToken = token || null;
    socket.data.authenticated = !!token;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`ws: client connected (${socket.id})`);

    socket.on('subscribe', (channel) => {
      if (typeof channel === 'string') {
        socket.join(channel);
        console.log(`ws: ${socket.id} joined ${channel}`);
      }
    });

    socket.on('unsubscribe', (channel) => {
      if (typeof channel === 'string') {
        socket.leave(channel);
      }
    });

    socket.on('disconnect', () => {
      console.log(`ws: client disconnected (${socket.id})`);
    });
  });

  // --- Event Bus Integration ---
  // Listen for agent job events and broadcast them over WebSockets
  eventBus.subscribe('job.created', (payload) => {
    console.log(`[WS] Broadcasting job.created: ${payload.jobId}`);
    broadcast('agent:job_created', payload);
  });

  eventBus.subscribe('job.running', (payload) => {
    console.log(`[WS] Broadcasting job.running: ${payload.jobId}`);
    broadcast('agent:job_running', payload);
  });

  eventBus.subscribe('job.completed', (payload) => {
    console.log(`[WS] Broadcasting job.completed: ${payload.jobId}`);
    broadcast('agent:job_completed', payload);
  });

  eventBus.subscribe('job.failed', (payload) => {
    console.log(`[WS] Broadcasting job.failed: ${payload.jobId}`);
    broadcast('agent:job_failed', payload);
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitToChannel(channel, event, data) {
  if (io) {
    io.to(channel).emit(event, data);
  }
}

export function broadcast(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

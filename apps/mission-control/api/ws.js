import { Server as SocketIOServer } from 'socket.io';

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

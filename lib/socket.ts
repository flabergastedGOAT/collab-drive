import { Server as NetServer } from 'http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function getIO(httpServer?: NetServer): Server {
  if (io) return io;
  if (!httpServer) throw new Error('Socket.io requires HTTP server');
  io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
  });
  return io;
}

export function emitToSpace(spaceId: string, event: string, data: unknown) {
  if (io) io.to(`space:${spaceId}`).emit(event, data);
}

import { Server } from 'socket.io';
import http from 'http';
import { updateBoard } from './boardEvents/updateBoard';
import { inviteUsers } from './workspaceEvents/inviteUsers';
import jwt, { JwtPayload } from 'jsonwebtoken';

export let io: Server;

export const userSockets = new Map<string, string>();

export default function setupWebSocketServer(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const authToken = socket.handshake.auth.token;

    if (!authToken) {
      return next(new Error('Authentication error: No token provided.'));
    }

    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SOCKET_ACCESS_TOKEN_SECRET!) as JwtPayload;

      (socket as any).userId = decoded.id;

      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;

    if (userId) {
      userSockets.set(userId, socket.id);
      console.log(`User ${userId} connected with socket ${socket.id}`);
    }

    socket.on('disconnect', () => {
      if (userId) {
        userSockets.delete(userId);
        console.log(`User ${userId} disconnected`);
      }
    });
    socket.on('update_board', updateBoard);
    socket.on('invite_users', inviteUsers);
  });
}

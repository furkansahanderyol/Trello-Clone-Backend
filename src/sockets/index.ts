import { Server } from 'socket.io';
import http from 'http';
import { updateBoard } from './boardEvents/updateBoard';
import { inviteUser } from './workspaceEvents/inviteUser';
import jwt from 'jsonwebtoken';

export let io: Server;

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
      jwt.verify(authToken, process.env.JWT_SOCKET_ACCESS_TOKEN_SECRET!);
      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('connect', () => {
      console.log('a user connected');
    });

    socket.on('update_board', updateBoard);
    socket.on('test', inviteUser);
  });
}

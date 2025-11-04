import { Server } from 'socket.io';
import http from 'http';
import { updateBoard } from './boardEvents/updateBoard';
import { inviteUsers } from './workspaceEvents/inviteUsers';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export let io: Server;

export const userSockets = new Map<string, string>();

const prisma = new PrismaClient();

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
      (socket as any).email = decoded.email;

      next();
    } catch (error) {
      return next(new Error('Authentication error: Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    const userEmail = (socket as any).email;

    if (userEmail) {
      userSockets.set(userEmail, socket.id);
      console.log(`User ${userEmail} connected with socket ${socket.id}`);
    }

    socket.on('disconnect', () => {
      if (userEmail) {
        userSockets.delete(userEmail);
        console.log(`User ${userEmail} disconnected`);
      }
    });

    socket.on('leave_room', (workspaceId: string) => {
      socket.leave(workspaceId);
      console.log(`User ${userEmail} left room: ${workspaceId}`);
    });

    socket.on('join_room', async (workspaceId: string) => {
      if (!userEmail) {
        socket.emit('error', 'Authentication required to join a room.');
        return;
      }

      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true },
      });

      if (!user) {
        socket.emit('error', 'User not found.');
        return;
      }

      const isMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspaceId,
            userId: user.id,
          },
        },
      });

      if (isMember) {
        socket.join(workspaceId);
        console.log(`User ${userEmail} joined room: ${workspaceId}`);
      } else {
        socket.emit('error', 'Not authorized to access this workspace.');
        console.warn(`Unauthorized attempt by ${userEmail} to join room: ${workspaceId}`);
      }

      socket.join(workspaceId);
      console.log(`User ${socket.id} joined room: ${workspaceId}`);
    });

    socket.on('update_board', updateBoard);
    socket.on('invite_users', inviteUsers);
  });
}

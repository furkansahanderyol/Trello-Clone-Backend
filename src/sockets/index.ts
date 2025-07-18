import { Server } from 'socket.io';
import http from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default function setupWebSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('connect', () => {
      console.log('a user connected');
    });

    socket.on('update_board', async (message) => {
      const parsedMessage = JSON.parse(message);
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: parsedMessage.workspaceId,
        },
        include: {
          boards: {
            include: {
              members: true,
              tasks: true,
            },
          },
        },
      });

      if (workspace) {
        io.emit('board_updated', workspace?.boards);
      }
    });
  });
}

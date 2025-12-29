import { io } from '../sockets';
import { prisma } from '../lib/prisma';

export async function broadcastBoardUpdate(workspaceId: string) {
  const updatedWorkspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      boards: {
        include: {
          tasks: { orderBy: { order: 'asc' } },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (updatedWorkspace && io) {
    io.to(workspaceId).emit('board_updated', updatedWorkspace.boards);
  }
}

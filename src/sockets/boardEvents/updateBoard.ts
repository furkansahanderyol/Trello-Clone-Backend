import { prisma } from '../../lib/prisma';
import { io } from '../index';

export async function updateBoard(message: string) {
  const parsedMessage = JSON.parse(message);
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: parsedMessage.workspaceId,
    },
    include: {
      boards: {
        include: {
          members: true,
          tasks: {
            orderBy: {
              order: 'asc',
            },
            include: {
              labels: {
                where: { isActive: true },
                select: {
                  label: {
                    select: {
                      id: true,
                      name: true,
                      color: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  if (workspace) {
    io.to(workspace.id).emit('board_updated', workspace?.boards);
  }
}

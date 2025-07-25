import { Board, BoardMember, PrismaClient, Task } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface IncomingTask {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  boardId: string;
  assignedToId: string | null;
}

interface IncomingBoard {
  id: string;
  title: string;
  createdAt: string;
  order: number;
  workspaceId: string;
  tasks: IncomingTask[];
}

export async function getAllBoards(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as { id: string };

  const { workspaceId } = req.params;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  if (!workspaceId || workspaceId === '') {
    res.status(400).json({ message: 'Workspace cannot be found' });
    return;
  }

  try {
    const boards = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
        members: {
          some: {
            userId: payload.id,
          },
        },
      },
      include: {
        boards: {
          include: {
            tasks: {
              orderBy: {
                order: 'asc',
              },
            },
            members: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!boards) {
      res.status(403).json({ message: 'Boards cannot be found.' });
      return;
    }

    res.status(200).json({ boards: boards?.boards });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Something went wrong.' });
  }

  return;
}

export async function createBoard(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);

  const { workspaceId, title } = req.body;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  if (!workspaceId) {
    res.status(403).json({ message: 'Workspace Id must be provided.' });
    return;
  }

  if (!title) {
    res.status(403).json({ message: 'Title must be provided' });
    return;
  }

  try {
    const lastBoard = await prisma.board.findFirst({
      orderBy: {
        order: 'desc',
      },
    });

    const nextOrder = lastBoard ? lastBoard.order + 1 : 0;

    const newBoard = {
      workspaceId: workspaceId,
      title: title,
      order: nextOrder,
    };

    await prisma.board.create({
      data: { ...newBoard },
    });

    res.status(200).json({ message: 'Board created successfully.' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error });
  }
}

export async function updateBoard(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);

  const { workspaceId, taskId, previousBoardId, newBoardId, oldIndex, newIndex } = req.body;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  if (!workspaceId) {
    res.status(400).json({ message: 'Workspace cannot be found.' });
    return;
  }

  try {
    if (previousBoardId === newBoardId) {
      if (oldIndex !== newIndex) {
        if (oldIndex < newIndex) {
          await prisma.task.updateMany({
            where: {
              boardId: previousBoardId,
              order: {
                gt: oldIndex,
                lte: newIndex,
              },
            },
            data: {
              order: { decrement: 1 },
            },
          });
        } else {
          await prisma.task.updateMany({
            where: {
              boardId: previousBoardId,
              order: {
                gte: newIndex,
                lt: oldIndex,
              },
            },
            data: {
              order: { increment: 1 },
            },
          });
        }

        await prisma.task.update({
          where: { id: taskId },
          data: { order: newIndex },
        });
      }
    } else {
      const newListCurrentCount = await prisma.task.count({
        where: { boardId: newBoardId },
      });

      const targetIndex = Math.min(newIndex, newListCurrentCount);
      await prisma.task.updateMany({
        where: {
          boardId: previousBoardId,
          order: {
            gt: oldIndex,
          },
        },
        data: {
          order: { decrement: 1 },
        },
      });

      await prisma.task.updateMany({
        where: {
          boardId: newBoardId,
          order: {
            gte: targetIndex,
          },
        },
        data: {
          order: { increment: 1 },
        },
      });

      await prisma.task.update({
        where: { id: taskId },
        data: {
          boardId: newBoardId,
          order: targetIndex,
        },
      });

      const oldListTasks = await prisma.task.findMany({
        where: { boardId: previousBoardId },
        orderBy: { order: 'asc' },
      });

      for (let i = 0; i < oldListTasks.length; i++) {
        if (oldListTasks[i].order !== i) {
          await prisma.task.update({
            where: { id: oldListTasks[i].id },
            data: { order: i },
          });
        }
      }

      const newListTasks = await prisma.task.findMany({
        where: { boardId: newBoardId },
        orderBy: { order: 'asc' },
      });

      for (let i = 0; i < newListTasks.length; i++) {
        if (newListTasks[i].order !== i) {
          await prisma.task.update({
            where: { id: newListTasks[i].id },
            data: { order: i },
          });
        }
      }
    }

    res.status(200).json({ message: 'Task moved and reordered successfully.' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error });
  }
}

export async function addTask(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);

  const { title, boardId } = req.body;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  if (title.length <= 0) {
    res.status(400).json({ message: 'Task title must be provided.' });
    return;
  }

  try {
    const lastTask = await prisma.task.findFirst({
      where: {
        boardId: boardId,
      },
      orderBy: {
        order: 'desc',
      },
    });

    const nextOrder = lastTask ? lastTask.order + 1 : 0;

    await prisma.task.create({
      data: {
        title: title,
        boardId: boardId,
        order: nextOrder,
      },
    });
    res.status(200).json({ message: 'Board updated.' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error });
    return;
  }
}

export async function updateTaskName(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);

  const { title, id } = req.body;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  if (title.length <= 0) {
    res.status(400).json({ message: 'Title must be provided.' });
    return;
  }

  if (!id) {
    res.status(400).json({ message: 'Task cannot be found.' });
    return;
  }

  try {
    await prisma.task.update({
      where: { id: id },
      data: { title },
    });

    res.status(200).json({ message: 'Task title updated successfully.' });
    return;
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error });
    return;
  }
}

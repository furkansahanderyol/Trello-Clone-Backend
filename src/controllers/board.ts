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

export async function updateBoardTasks(req: Request, res: Response) {
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
    if (newBoardId === previousBoardId) {
      // 1. Board’un gerçekten workspace’e ait olduğunu doğrula
      const board = await prisma.board.findFirst({
        where: {
          id: previousBoardId,
          workspaceId: workspaceId,
        },
      });

      if (!board) {
        res.status(403).json({ message: 'Board does not belong to the given workspace.' });
        return;
      }

      // 2. O board’daki tüm task’leri sıraya göre al
      const tasks = await prisma.task.findMany({
        where: { boardId: previousBoardId },
        orderBy: { order: 'asc' },
      });

      // 3. Taşınacak task’i bul
      const movingTask = tasks.find((t) => t.id === taskId);
      if (!movingTask) {
        res.status(404).json({ message: 'Task not found in the specified board.' });
        return;
      }

      // 4. Listeden çıkar ve sıralamayı ayarla
      const updatedTasks = tasks
        .filter((t) => t.id !== taskId)
        .map((task, index) => {
          if (oldIndex < newIndex) {
            if (index >= oldIndex && index < newIndex) {
              return { ...task, order: index };
            }
          } else if (oldIndex > newIndex) {
            if (index >= newIndex && index < oldIndex) {
              return { ...task, order: index + 1 };
            }
          }
          return { ...task, order: index };
        });

      // 5. Taşınan görevi yeni konumuna ekle
      updatedTasks.splice(newIndex, 0, { ...movingTask, order: newIndex });

      // 6. Güncellemeleri topluca işle
      await prisma.$transaction(
        updatedTasks.map((task) =>
          prisma.task.update({
            where: { id: task.id },
            data: { order: task.order },
          }),
        ),
      );
    } else {
      const [sourceBoard, targetBoard] = await Promise.all([
        prisma.board.findFirst({
          where: { id: previousBoardId, workspaceId },
        }),
        prisma.board.findFirst({
          where: { id: newBoardId, workspaceId },
        }),
      ]);

      if (!sourceBoard || !targetBoard) {
        res.status(403).json({ message: 'One or both boards do not belong to the given workspace.' });
        return;
      }

      const movingTask = await prisma.task.findFirst({
        where: {
          id: taskId,
          boardId: previousBoardId,
        },
      });

      if (!movingTask) {
        res.status(404).json({ message: 'Task not found in previous board.' });
        return;
      }

      const oldTasks = await prisma.task.findMany({
        where: {
          boardId: previousBoardId,
          NOT: { id: taskId },
        },
        orderBy: { order: 'asc' },
      });

      const newTasks = await prisma.task.findMany({
        where: {
          boardId: newBoardId,
        },
        orderBy: { order: 'asc' },
      });

      const updatedOldTasks = oldTasks.map((task, index) => ({
        ...task,
        order: index,
      }));

      const updatedNewTasks: (typeof newTasks)[number][] = [
        ...newTasks.slice(0, newIndex),
        { ...movingTask, order: newIndex, boardId: newBoardId },
        ...newTasks.slice(newIndex),
      ].map((task, index) => ({
        ...task,
        order: index,
      }));

      await prisma.$transaction([
        prisma.task.update({
          where: { id: taskId },
          data: {
            boardId: newBoardId,
            order: newIndex,
          },
        }),
        ...updatedOldTasks.map((task) =>
          prisma.task.update({
            where: { id: task.id },
            data: { order: task.order },
          }),
        ),
        ...updatedNewTasks.map((task) =>
          prisma.task.update({
            where: { id: task.id },
            data: {
              order: task.order,
              ...(task.id === taskId ? {} : {}),
            },
          }),
        ),
      ]);
    }

    res.status(200).json({ message: 'Task moved and reordered successfully.' });
    return;
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

export async function updateBoardOrders(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);

  const { workspaceId, boardId, newOrder } = req.body;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  try {
    const boards = await prisma.board.findMany({
      where: { workspaceId },
      orderBy: { order: 'asc' },
    });

    const movingBoard = boards.find((b) => b.id === boardId);
    if (!movingBoard) {
      res.status(404).json({ message: 'Board not found in workspace.' });
      return;
    }

    const oldIndex = movingBoard.order;

    if (oldIndex === newOrder) {
      res.status(200).json({ message: 'No changes needed.' });
      return;
    }

    const updatedBoards = boards.filter((b) => b.id !== boardId).map((board, index) => board); // sadece kopya

    updatedBoards.splice(newOrder, 0, { ...movingBoard });

    const finalBoards = updatedBoards.map((board, index) => ({
      id: board.id,
      order: index,
    }));

    await prisma.$transaction(
      finalBoards.map((b) =>
        prisma.board.update({
          where: { id: b.id },
          data: { order: b.order },
        }),
      ),
    );

    res.status(200).json({ message: 'Board order updated successfully.' });
    return;
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error });
  }
}

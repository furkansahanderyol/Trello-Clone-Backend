import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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
            tasks: true,
            members: true,
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

  const newBoard = {
    workspaceId: workspaceId,
    title: title,
  };

  try {
    await prisma.board.create({
      data: { ...newBoard },
    });

    res.status(200).json({ message: 'Board created successfully.' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error });
  }
}

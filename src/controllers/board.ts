import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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
      data: newBoard,
    });

    res.status(200).json({ message: 'Board created successfully.' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error });
  }
}

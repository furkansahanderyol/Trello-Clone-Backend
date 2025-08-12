import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { changeFileLocation } from '../helpers/changeFileLocation';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getTaskData(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, boardId, taskId } = req.body;

  if (!workspaceId) {
    res.status(403).json({ message: 'Workspace must be provided.' });
    return;
  }

  if (!boardId) {
    res.status(403).json({ message: 'Board must be provided.' });
    return;
  }

  if (!taskId) {
    res.status(403).json({ message: 'Task must be provided.' });
    return;
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      boardId: boardId,
      board: {
        id: boardId,
        workspaceId: workspaceId,
      },
    },
    include: {
      board: {
        include: {
          workspace: true,
        },
      },
    },
  });

  res.status(200).json(task);
}

export async function uploadTaskImage(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, boardId, taskId } = req.body;

  if (!workspaceId) {
    res.status(403).json({ message: 'Workspace ID cannot be found.' });
    return;
  }
  if (!boardId) {
    res.status(403).json({ message: 'Board ID cannot be found.' });
    return;
  }
  if (!taskId) {
    res.status(403).json({ message: 'Task ID cannot be found.' });
    return;
  }

  const uploadedFiles = req.files as Express.Multer.File[];

  const urls = uploadedFiles.map((file) => ({
    originalName: file.originalname,
    filename: file.filename,
    url: `${req.protocol}://${req.get('host')}/temp_uploads/${boardId}/${file.filename}`,
  }));

  res.status(200).json({ images: urls });
}

export async function uploadTaskDescription(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, boardId, taskId, description } = req.body;

  if (!workspaceId) {
    res.status(403).json({ message: 'Workspace ID cannot be found.' });
    return;
  }
  if (!boardId) {
    res.status(403).json({ message: 'Board ID cannot be found.' });
    return;
  }
  if (!taskId) {
    res.status(403).json({ message: 'Task ID cannot be found.' });
    return;
  }

  // Carry saved images to the /uploads
  const updatedContent = await Promise.all(
    description.content.map(async (item: any) => {
      if (item.type !== 'image') return item;

      let pathname = new URL(item.attrs.src).pathname;
      if (pathname.startsWith('/')) pathname = pathname.slice(1);
      if (pathname.startsWith('temp_uploads/')) {
        pathname = pathname.slice('temp_uploads/'.length);
      }

      await changeFileLocation(pathname, 'uploads');

      return {
        ...item,
        attrs: {
          ...item.attrs,
          src: item.attrs.src.replace('temp_uploads', 'uploads'),
        },
      };
    }),
  );

  // Clean remaining images from /temp_uploads
  const tempPath = path.join(process.cwd(), 'temp_uploads', boardId);

  fs.rm(tempPath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error('Error occurred when folder trying to be delete', err);
    }
  });

  const updatedDescription = JSON.stringify(updatedContent);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      description: updatedDescription,
    },
  });

  res.status(200).json();
}

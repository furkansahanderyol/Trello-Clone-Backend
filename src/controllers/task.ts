import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import { changeFileLocation } from '../helpers/changeFileLocation';

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

  const uploadedImages: { type: string; attrs: { src: string } }[] = description.content.filter(
    (data: { type: string; content: { type: string; content: [] }[] }) => {
      return data.type === 'image';
    },
  );

  uploadedImages.map((image) => {
    let pathname = new URL(image.attrs.src).pathname;
    if (pathname.startsWith('/')) {
      pathname = pathname.slice(1);
    }
    if (pathname.startsWith('temp_uploads/')) {
      pathname = pathname.slice('temp_uploads/'.length);
    }
    changeFileLocation(pathname, 'uploads');
  });

  res.status(200).json();
}

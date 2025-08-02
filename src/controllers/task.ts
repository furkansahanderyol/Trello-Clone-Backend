import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

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
    url: `/uploads/${file.filename}`,
  }));

  res.status(200).json({ images: urls });
}

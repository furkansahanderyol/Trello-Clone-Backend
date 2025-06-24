import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

interface CustomJwtPayload extends jwt.JwtPayload {
  email: string;
  isVerified: boolean;
}

export async function createWorkspace(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid user.' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
    const user = await prisma.user.findFirst({
      where: {
        email: payload.email,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { name, color } = req.body;

    const newWorkspace = await prisma.workspace.create({
      data: {
        name,
        color,
        createdBy: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'admin',
          },
        },
      },
    });

    res.status(201).json({ message: 'Workspace created successfully', workspace: newWorkspace });
    return;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }
}

export async function getAllWorkspaces(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid user.' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const workspaces = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });

    res.status(200).json({ workspaces: workspaces });
    return;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }
}

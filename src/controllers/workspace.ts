import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { workspaceService } from '../services/workspaceService';

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
      include: { members: true },
    });

    const workspaceMemberWithWorkspace = newWorkspace.members.map((member) => ({
      ...member,
      workspace: {
        id: newWorkspace.id,
        name: newWorkspace.name,
        color: newWorkspace.color,
        createdAt: newWorkspace.createdAt,
        createdBy: newWorkspace.createdBy,
      },
    }));

    res.status(201).json({ message: 'Workspace created successfully', workspace: workspaceMemberWithWorkspace });
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

export async function getWorkspace(req: Request, res: Response) {
  const { id } = req.params;
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid user.' });
    return;
  }

  if (!id) {
    res.status(404).json({ message: 'Workspace cannot found.' });
    return;
  }

  const workspaceData = await prisma.workspace.findUnique({
    where: { id: id },
  });

  if (!workspaceData) {
    res.status(404).json({ message: 'Workspace cannot found.' });
  }

  res.status(200).json(workspaceData);
  return;
}

export async function inviteUsers(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid user.' });
    return;
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const invitedById = await prisma.user.findFirst({
    where: { email: payload.email },
  });

  if (!invitedById) {
    res.status(404).json({ message: 'User cannot be found.' });
    return;
  }

  const { workspaceId, invitedEmails, message } = req.body;

  if (!workspaceId || !Array.isArray(invitedEmails)) {
    res.status(400).json({ message: 'workspaceId and invitedEmails are required.' });
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: { email: { in: invitedEmails } },
    });

    if (users.length === 0) {
      res.status(404).json({ message: 'No users found with provided emails.' });
      return;
    }

    const invitedUserIds = users.map((user) => user.id);

    const invites = await workspaceService.inviteUsers(workspaceId, invitedUserIds, invitedById?.id, message);

    res.status(200).json({ message: 'Invitations sent successfully.', invites });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
}

export async function acceptWorkspaceInvite(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid user.' });
    return;
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const invitedUser = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true, email: true },
  });

  if (!invitedUser) {
    res.status(404).json({ message: 'User cannot be found.' });
    return;
  }

  const { workspaceId, email } = req.body;

  if (!workspaceId) {
    res.status(400).json({ message: 'Missing workspace ID.' });
    return;
  }

  try {
    const invite = await prisma.workspaceInvite.findFirst({
      where: {
        workspaceId: workspaceId,
        invitedUserId: invitedUser.id,
        status: 'pending',
      },
    });

    console.log('invite', invite);

    if (!invite) {
      res.status(404).json({ message: 'Pending invite not found for this user and workspace.' });
      return;
    }

    await prisma.$transaction([
      prisma.workspaceInvite.update({
        where: {
          id: invite.id,
        },
        data: {
          status: 'accepted',
        },
      }),

      prisma.workspaceMember.create({
        data: {
          workspaceId: workspaceId,
          userId: invitedUser.id,
          role: 'member',
        },
      }),

      prisma.notification.updateMany({
        where: {
          inviteId: invite.id,
          userId: invitedUser.id,
          read: false,
        },
        data: {
          read: true,
        },
      }),
    ]);

    res.status(200).json({ message: 'Success.' });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
}

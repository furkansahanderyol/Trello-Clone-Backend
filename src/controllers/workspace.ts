import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { workspaceService } from '../services/workspaceService';
import { prisma } from '../lib/prisma';
import { io, userSockets } from '../sockets';

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

  let payload: CustomJwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const workspaceData = await prisma.workspace.findUnique({
    where: { id: id },
    include: {
      members: {
        include: {
          user: {
            select: {
              name: true,
              surname: true,
              email: true,
              profileImage: true,
            },
          },
        },
        orderBy: {
          user: {
            name: 'asc',
          },
        },
      },
    },
  });

  if (!workspaceData) {
    res.status(404).json({ message: 'Workspace cannot found.' });
  }

  const requestingUserId = payload.id;

  const currentUserMemberRecord = workspaceData?.members.find((member) => member.userId === requestingUserId);

  const isAdmin = currentUserMemberRecord?.role === 'admin';

  const cleanedMembers = workspaceData?.members.map((member) => {
    return {
      role: member.role,
      name: member.user.name,
      surname: member.user.surname,
      profileImage: member.user.profileImage,
      email: member.user.email,
    };
  });

  const finalResponse = {
    id: workspaceData?.id,
    name: workspaceData?.name,
    color: workspaceData?.color,
    createdAt: workspaceData?.createdAt,
    cratedBy: workspaceData?.createdBy,
    members: cleanedMembers,
    isAdmin: isAdmin,
  };

  res.status(200).json(finalResponse);
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

  const { workspaceId } = req.body;

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

export async function getWorkspaceMembers(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid user.' });
    return;
  }

  let payload: CustomJwtPayload;

  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { id } = req.params;

  if (!id) {
    res.status(400).json({ message: 'Workspace ID is required.' });
    return;
  }

  try {
    const existingMemberIdResult = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: id,
      },
      select: {
        userId: true,
      },
    });

    const existingMemberIds = existingMemberIdResult.map((member) => member.userId);

    const otherUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: existingMemberIds,
        },
      },
      select: {
        name: true,
        surname: true,
        email: true,
        profileImage: true,
      },
    });

    res.status(200).json(otherUsers);
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
}

export async function unassignUser(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid user.' });
    return;
  }

  let payload: CustomJwtPayload;

  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { taskId, email } = req.body;

  if (!taskId || !email) {
    res.status(400).json({ message: 'Task ID and user email are required.' });
    return;
  }

  try {
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
      select: {
        board: {
          select: {
            workspaceId: true,
          },
        },
      },
    });

    if (!task || !task.board.workspaceId) {
      res.status(404).json({ message: 'Task or associated workspace not found.' });
      return;
    }

    const workspaceId = task.board.workspaceId;

    const requestingUserRole = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceId,
          userId: payload.id,
        },
      },
    });

    if (requestingUserRole?.role !== 'admin') {
      res.status(403).json({
        message: 'Forbidden. Only administrators can unassign users from tasks.',
      });
      return;
    }

    const userToUnassign = await prisma.user.findUnique({
      where: { email: email },
      select: { id: true },
    });

    if (!userToUnassign) {
      res.status(404).json({ message: 'User to unassign not found.' });
      return;
    }

    const userId = userToUnassign.id;

    const unassigned = await prisma.assignedTask.deleteMany({
      where: {
        taskId: taskId,
        userId: userId,
      },
    });

    if (unassigned.count === 0) {
      res.status(404).json({ message: 'The user was not assigned to this task.' });
      return;
    }

    res.status(200).json({
      message: 'User successfully unassigned from the task.',
      unassignedCount: unassigned.count,
    });
    return;
  } catch (error) {
    console.error('Error unassigning user from task:', error);
    res.status(500).json({ error: 'An error occurred during the unassignment process.' });
    return;
  }
}

export async function removeWorkspaceMember(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  let payload: CustomJwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
  } catch (e) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, email } = req.body;
  const requestingUserId = payload.id;

  if (!workspaceId || !email) {
    res.status(400).json({ message: 'Workspace ID and user email are required.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    if (user.id === requestingUserId) {
      res.status(403).json({ message: 'You cannot remove yourself from the workspace.' });
      return;
    }

    const requestingUserRole = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceId,
          userId: requestingUserId,
        },
      },
      select: {
        role: true,
      },
    });

    if (requestingUserRole?.role !== 'admin') {
      res.status(403).json({
        message: 'Only admins can remove members from workspace.',
      });
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceId,
          userId: user.id,
        },
      },
    });

    res.status(200).json({ message: 'User successfully removed from the workspace.' });
    return;
  } catch (error) {
    console.error('Something went wong:', error);
    res.status(500).json({ error: 'An error occurred during the removing process.' });
    return;
  }
}

export async function deleteWorkspace(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  let payload: CustomJwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
  } catch (e) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { id: workspaceId } = req.params;
  const userId = payload.id;

  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspaceId },
      include: { user: { select: { email: true } } },
    });

    const isAdmin = members.find((member) => member.role === 'admin' && member.userId === userId);

    if (!isAdmin) {
      res.status(403).json({ message: 'You do not have permission.' });
      return;
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    if (io) {
      io.to(workspaceId).emit('workspace_deleted', {
        workspaceId: workspaceId,
        message: 'This workspace deleted.',
      });
      io.in(workspaceId).socketsLeave(workspaceId);

      members.forEach((member) => {
        const socketId = userSockets.get(member.user.email);
        if (socketId) {
          io.to(socketId).emit('workspace_list_updated', {
            action: 'remove',
            workspaceId,
          });
        }
      });
    }

    res.status(200).json({ message: 'Workspace deleted.' });
    return;
  } catch (error) {
    console.error('Workspace deletion error', error);
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
}

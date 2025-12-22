import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { changeFileLocation } from '../helpers/changeFileLocation';
import { prisma } from '../lib/prisma';

interface CustomJwtPayload extends jwt.JwtPayload {
  id: string;
  email: string;
  isVerified: boolean;
}

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
      labels: {
        where: { isActive: true },
        select: {
          label: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
      comments: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              surname: true,
              email: true,
              profileImage: true,
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
      assignedUsers: {
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
      },
    },
  });

  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }

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
    url: `${req.protocol}://${req.get('host')}/temp_uploads/${taskId}/${file.filename}`,
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
  const tempPath = path.join(process.cwd(), 'temp_uploads', taskId);

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

export async function taskComment(req: Request, res: Response) {
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

  const { workspaceId, boardId, taskId, comment, user } = req.body;

  const updatedContent = await Promise.all(
    comment.content.map(async (item: any) => {
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
  const tempPath = path.join(process.cwd(), 'temp_uploads', taskId);

  fs.rm(tempPath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error('Error occurred when folder trying to be delete', err);
    }
  });

  const updatedComment = JSON.stringify(updatedContent);

  const lastComment = await prisma.comment.findFirst({
    where: { taskId },
    orderBy: { order: 'desc' },
  });

  const nextOrder = lastComment ? lastComment.order + 1 : 0;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    await prisma.comment.create({
      data: {
        content: updatedComment,
        taskId,
        authorId: dbUser.id,
        order: nextOrder,
      },
    });

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: `Something went wrong, ${error}` });

    return;
  }
}

export async function deleteTaskComment(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, boardId, taskId, commentId } = req.body;

  try {
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        task: {
          id: taskId,
          board: {
            id: boardId,
            workspaceId: workspaceId,
          },
        },
      },
      include: {
        author: true,
      },
    });

    if (!existingComment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    if (existingComment.authorId !== payload.id) {
      res.status(403).json({ error: 'You are not allowed to delete this comment.' });
      return;
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    res.status(200).json({ success: true });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong.' });
  }
}

export async function updateTaskComment(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, boardId, taskId, commentId, comment } = req.body;

  try {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        boardId,
        board: {
          workspaceId,
        },
      },
      include: {
        comments: true,
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    const existingComment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        taskId: task.id,
        authorId: payload.userId,
      },
    });

    if (!existingComment) {
      res.status(404).json({ error: 'Comment not found or not owned by you.' });
      return;
    }

    const updatedContent = await Promise.all(
      comment.content.map(async (item: any) => {
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
    const tempPath = path.join(process.cwd(), 'temp_uploads', taskId);

    fs.rm(tempPath, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error('Error occurred when folder trying to be delete', err);
      }
    });

    const updatedComment = JSON.stringify(updatedContent);

    await prisma.comment.update({
      where: { id: commentId },
      data: { content: updatedComment },
    });

    res.status(200).json({
      message: 'Comment updated successfully',
    });

    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getWorkspaceLabels(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId } = req.body;

  if (!workspaceId) {
    res.status(400).json({ message: 'workspaceId is required.' });
    return;
  }

  try {
    const labels = await prisma.label.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    res.status(200).json({ success: true, labels });
  } catch (error) {
    console.error('getWorkspaceLabels error:', error);
    res.status(500).json({ message: 'Something went wrong.' });
  }
}

export async function createWorkspaceLabel(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, boardId, taskId, labelName, labelColor } = req.body;

  if (!workspaceId || !boardId || !taskId || !labelName || !labelColor) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        board: {
          id: boardId,
          workspaceId: workspaceId,
        },
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found in the given workspace/board.' });
      return;
    }

    let label = await prisma.label.findFirst({
      where: { workspaceId, name: labelName, color: labelColor },
    });

    if (!label) {
      label = await prisma.label.create({
        data: {
          name: labelName,
          color: labelColor,
          workspaceId,
        },
      });
    }

    const existingTaskLabel = await prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId: task.id,
          labelId: label.id,
        },
      },
    });
    if (existingTaskLabel) {
      res.status(409).json({ error: 'Label already attached to this task.' });
      return;
    }

    await prisma.taskLabel.create({
      data: {
        taskId: task.id,
        labelId: label.id,
      },
    });

    const taskWithLabels = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        labels: {
          include: { label: { select: { id: true, name: true, color: true } } },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Label successfully added to task.',
      labels: taskWithLabels?.labels.map((l) => l.label) || [],
    });
    return;
  } catch (error) {
    console.error('createTaskLabel error:', error);
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
}

export async function editWorkspaceLabel(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, boardId, taskId, labelId, labelName, labelColor } = req.body;

  if (!workspaceId || !boardId || !taskId || !labelId || !labelName || !labelColor) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const label = await prisma.label.findFirst({
      where: {
        id: labelId,
        workspaceId,
      },
    });

    if (!label) {
      res.status(404).json({ message: 'Label not found in this workspace.' });
      return;
    }

    await prisma.label.update({
      where: { id: labelId },
      data: {
        name: labelName,
        color: labelColor,
      },
    });

    const labels = await prisma.label.findMany({
      where: { workspaceId },
      select: { id: true, name: true, color: true },
      orderBy: { order: 'asc' },
    });

    res.status(200).json({ success: true, labels: labels });
    return;
  } catch (error) {
    console.error('editTaskLabel error:', error);
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
}

export async function deleteWorkspaceLabel(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, taskId, labelId } = req.body;

  if (!workspaceId || !labelId) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const label = await prisma.label.findFirst({
      where: { id: labelId, workspaceId },
    });

    if (!label) {
      res.status(404).json({ message: 'Label not found in this workspace.' });
      return;
    }

    await prisma.taskLabel.deleteMany({
      where: { labelId },
    });

    await prisma.label.delete({
      where: { id: labelId },
    });

    const labels = await prisma.taskLabel.findMany({
      where: { taskId },
      include: {
        label: true,
      },
      orderBy: { order: 'asc' },
    });

    res.status(200).json({ success: true, labels: labels });
    return;
  } catch (error) {
    console.error('deleteTaskLabel error:', error);
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
}

export async function getTaskLabelsWithStatus(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { workspaceId, taskId } = req.body;

  if (!workspaceId || !taskId) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    const workspaceLabels = await prisma.label.findMany({
      where: { workspaceId },
      select: { id: true, name: true, color: true },
    });

    const taskLabels = await prisma.taskLabel.findMany({
      where: { taskId },
      select: { labelId: true, isActive: true, label: true },
    });

    const labelsWithStatus = workspaceLabels.map((label) => {
      const taskLabel = taskLabels.find((tl) => tl.labelId === label.id);
      return {
        label: {
          ...label,
        },
        orderBy: { order: 'asc' },
        isActive: taskLabel ? taskLabel.isActive : false,
      };
    });

    res.status(200).json({ success: true, labels: labelsWithStatus });
  } catch (error) {
    console.error('getTaskLabelsWithStatus error:', error);
    res.status(500).json({ message: 'Something went wrong.' });
  }
}

export async function toggleTaskLabel(req: Request, res: Response) {
  const { workspaceId, taskId, labelId } = req.body;

  if (!taskId || !labelId) {
    res.status(400).json({ message: 'Missing required fields.' });
    return;
  }

  try {
    let taskLabel = await prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    if (!taskLabel) {
      taskLabel = await prisma.taskLabel.create({
        data: { taskId, labelId, isActive: true },
      });
    } else {
      taskLabel = await prisma.taskLabel.update({
        where: { taskId_labelId: { taskId, labelId } },
        data: { isActive: !taskLabel.isActive },
      });
    }

    const taskLabels = await prisma.taskLabel.findMany({
      where: { taskId },
      include: {
        label: true,
      },
      orderBy: { order: 'asc' },
    });

    res.status(200).json({ success: true, labels: taskLabels });
  } catch (error) {
    console.error('toggleTaskLabel error:', error);
    res.status(500).json({ message: 'Something went wrong.' });
  }
}

export async function addMemberToTask(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!payload) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
    return;
  }

  const { email, taskId } = req.body;

  if (!email || !taskId) {
    res.status(400).json({ message: 'Email and Task ID are required.' });
    return;
  }

  try {
    const userToAssign = await prisma.user.findUnique({
      where: { email: email },
      select: { id: true, name: true, surname: true },
    });

    if (!userToAssign) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const assignedUserId = userToAssign.id;

    const isAlreadyAssigned = await prisma.assignedTask.findUnique({
      where: {
        taskId_userId: {
          taskId: taskId,
          userId: assignedUserId,
        },
      },
    });

    if (isAlreadyAssigned) {
      res.status(200).json({
        message: `${userToAssign.name} is already assigned to this task.`,
        task: await getUpdatedTaskData(taskId),
      });

      return;
    }

    await prisma.assignedTask.create({
      data: {
        taskId: taskId,
        userId: assignedUserId,
      },
    });

    const updatedTask = await getUpdatedTaskData(taskId);

    res.status(200).json({
      message: `${userToAssign.name} ${userToAssign.surname} has been successfully assigned to the task.`,
      task: updatedTask,
    });
    return;
  } catch (error) {
    console.error('Something went wrong.');
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
}

export async function getAvailableTaskMembers(req: Request, res: Response) {
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

  const { workspaceId, taskId } = req.params;

  if (!workspaceId || !taskId) {
    res.status(400).json({ message: 'Workspace ID and Task ID are required.' });
    return;
  }

  try {
    const isMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceId,
          userId: payload.id,
        },
      },
    });

    if (!isMember) {
      res.status(400).json({ message: 'User is not a member of this workspace.' });
      return;
    }

    const assignedUsersResult = await prisma.assignedTask.findMany({
      where: { taskId: taskId },
      select: { userId: true },
    });

    const assignedUserIds = assignedUsersResult.map((a) => a.userId);

    const availableUsers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: workspaceId,
        userId: {
          notIn: assignedUserIds,
        },
      },
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
    });

    const users = availableUsers.map((user) => user.user);

    res.status(200).json(users);
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
}

async function getUpdatedTaskData(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedUsers: {
        include: {
          user: {
            select: {
              name: true,
              surname: true,
              profileImage: true,
            },
          },
        },
      },
    },
  });
}

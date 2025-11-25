import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { userSchema } from '../schemas/userSchema';
import { PrismaClient, User } from '@prisma/client';
import { generateCode } from '../helpers/generateCode';
import nodemailer from 'nodemailer';
import redis, { redisClient } from '../lib/redis';
import bcrypt from 'bcrypt';
import { generateToken } from '../lib/generateToken';
import jwt from 'jsonwebtoken';
import { changePasswordSchema } from '../schemas/changePasswordSchema';
import { setTokenCookie } from '../helpers/setTokenCookie';

const prisma = new PrismaClient();

interface CustomJwtPayload extends jwt.JwtPayload {
  id: string;
  email: string;
  isVerified: boolean;
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  const checkPassword = await bcrypt.compare(password, user?.password || '');

  if (!user) {
    res.status(403).json({ message: 'User cannot be found.' });
    return;
  }

  const accessToken = generateToken(
    user?.id,
    { email: user.email, isVerified: user?.isVerified! },
    process.env.JWT_ACCESS_TOKEN_SECRET!,
    '7d',
  );

  const wsToken = generateToken(
    user.id,
    { email: user.email, isVerified: user.isVerified },
    process.env.JWT_SOCKET_ACCESS_TOKEN_SECRET!,
    '7d',
  );

  if (!checkPassword) {
    res.status(400).json({ message: 'Invalid email or password.' });
    return;
  }

  if (!user?.isVerified) {
    res.status(200).json({ message: 'Logged in. Please verify your email address.' });
    return;
  }

  setTokenCookie(res, 'socket-token', wsToken, false);
  setTokenCookie(res, 'access-token', accessToken, true);

  res.status(200).json({
    message: 'Welcome back.',
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const result = userSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      errors: result.error.flatten().fieldErrors,
    });

    return;
  }

  const { email, password, name, surname } = result.data;

  try {
    const isUserExisting = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    if (isUserExisting) {
      res.status(409).json({ message: 'Email already in use.' });
      return;
    }

    const user = await userService.register(name, surname, email, password);
    const newUser = await prisma.user.create({
      data: user,
    });
    const verifyToken = generateToken(
      newUser.id,
      { email: email, isVerified: false },
      process.env.JWT_ACCESS_TOKEN_SECRET!,
      '7d',
    );

    sendVerificationCode(email);

    setTokenCookie(res, 'access-token', verifyToken, true);
    res.status(201).json({
      message: 'Registration successful! Please verify your email for access all the features.',
      user: newUser,
    });

    return;
  } catch (error) {
    console.error('Register-Error ->', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

export async function registerSuccess(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  const { email, code } = req.body;
  const redisKey = `verify:${email}`;
  const storedCode = await redisClient.get(redisKey);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(403).json({ message: 'User cannot be found.' });
    return;
  }

  if (!token) {
    res.status(400).json({ message: 'Invalid token.' });
    return;
  }

  if (!storedCode) {
    res.status(400).json({ message: 'Your verify code is expired. Please request a new code.' });
    return;
  }

  if (!code) {
    res.status(400).json({ message: 'Invalid Code.' });
    return;
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!);
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired authorization token.' });
  }

  if (!payload) {
    res.status(403).json({ message: 'Authorization token must be provided.' });
    return;
  }

  if (payload && code === storedCode) {
    await prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
      },
    });

    const accessToken = generateToken(
      user?.id,
      { email: email, isVerified: true },
      process.env.JWT_ACCESS_TOKEN_SECRET!,
      '7d',
    );

    setTokenCookie(res, 'access-token', accessToken, true);
    res.status(200).json({ message: 'Your account is verified successfully.' });
    await redisClient.del(redisKey);
    return;
  }
}

export async function resendVerificationCode(req: Request, res: Response) {
  const { email } = req.body;
  const redisKey = `verify:${email}`;
  const isCodeExisting = await redisClient.get(redisKey);

  if (isCodeExisting) {
    const ttl = await redisClient.ttl(redisKey);

    res
      .status(400)
      .json({ message: 'Please wait before requesting a new code. Try again in a few minutes.', remainingTime: ttl });
    return;
  }

  sendVerificationCode(email);

  res.status(200).json({ message: 'New verification code sent to your email.' });
}

export async function logout(req: Request, res: Response) {
  res.cookie('access-token', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  res.status(201).json({ message: 'Logout successful.' });
}

async function sendVerificationCode(email: string) {
  const code = generateCode();
  const key = `verify:${email}`;

  await redis.set(key, code, 'EX', 120);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: 'Tasky <no-reply@myapp.com>',
    to: email,
    subject: 'Verification Code',
    text: `Your verification code is: ${code}`,
  });
}

export async function checkVerified(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(403).json({ message: 'No token provided.' });

    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
    const isVerified = payload.isVerified;

    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      res.status(403).json({ message: 'Invalid user.' });
      return;
    }

    if (isVerified) {
      res.status(203).json({ redirectTo: '/dashboard' });
      return;
    } else {
      res.status(203).json({ redirectTo: `/auth/register-success?email=${user.email}` });
      return;
    }
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token.' });
    return;
  }
}

export async function authGoogle(req: Request, res: Response) {
  const user = req.user as User;

  const cookie = generateToken(
    user.id,
    { email: user.email, isVerified: true },
    process.env.JWT_ACCESS_TOKEN_SECRET!,
    '7d',
  );

  const wsToken = generateToken(
    user.id,
    { email: user.email, isVerified: user.isVerified },
    process.env.JWT_SOCKET_ACCESS_TOKEN_SECRET!,
    '7d',
  );

  setTokenCookie(res, 'socket-token', wsToken, false);
  setTokenCookie(res, 'access-token', cookie, true);

  res.redirect('http://localhost:3000/dashboard');
}

export async function getUser(req: Request, res: Response) {
  const token = req.cookies['access-token'];

  if (!token) {
    res.status(403).json({ message: 'No token provided.' });

    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      res.status(403).json({ message: 'User cannot be found.' });
      return;
    }

    res.status(201).json({
      user: {
        name: user.name,
        surname: user.surname,
        email: user.email,
        profileImage: user.profileImage,
      },
    });

    return;
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token.' });
    return;
  }
}

export async function updateProfileImage(req: Request, res: Response) {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: 'Upload failed.' });
      return;
    }

    const token = req.cookies['access-token'];
    const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      res.status(400).json({ message: 'Invalid user.' });
      return;
    }

    // Edits the url.
    const profileImagePath = file.path.replace(/\\/g, '/');

    await prisma.user.update({
      where: { email: user.email },
      data: { profileImage: profileImagePath },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
    return;
  }
}

export async function changePassword(req: Request, res: Response) {
  const token = req.cookies['access-token'];
  const payload = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!) as CustomJwtPayload;
  const user = await prisma.user.findUnique({ where: { email: payload.email } });

  const result = changePasswordSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      errors: result.error.flatten().fieldErrors,
    });

    return;
  }

  const { currentPassword, newPassword, newPasswordConfirm } = result.data;

  try {
    if (!user) {
      res.status(500).json({ message: 'Invalid user.' });
      return;
    }

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      res.status(400).json({ message: 'All fields should be provided.' });
      return;
    }

    if (user?.password === currentPassword) {
      res.status(400).json('New password must be different from current password.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      res.status(400).json({ message: 'Passwords must match.' });
      return;
    }

    await prisma.user.update({
      where: { email: user.email },
      data: {
        password: bcrypt.hashSync(newPassword, 10),
      },
    });

    res.status(200).json({ message: 'Password updated successfully.' });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function searchUser(req: Request, res: Response) {
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

  const { input } = req.body;

  try {
    const users = await prisma.user.findMany({
      where: {
        id: {
          not: payload.id,
        },
        OR: [{ email: { contains: input, mode: 'insensitive' } }, { name: { contains: input, mode: 'insensitive' } }],
      },
      select: {
        name: true,
        surname: true,
        email: true,
        profileImage: true,
        isVerified: true,
      },
      take: 10,
    });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong.' });
  }
}

export async function getUserNotifications(req: Request, res: Response) {
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

  const userId = payload.id;

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: userId,
        read: false,
      },
    });

    res.status(200).json({ count: unreadCount, notifications });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}

export async function markNotificationAsRead(req: Request, res: Response) {
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

  const notificationId = req.params.notificationId;
  const requestingUserId = payload.id;

  if (!notificationId) {
    res.status(400).json({ message: 'Notification ID is required.' });
    return;
  }

  try {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: requestingUserId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    res.status(200).json({ message: 'Notification successfully marked as read.' });
    return;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Something went wrong.' });
    return;
  }
}

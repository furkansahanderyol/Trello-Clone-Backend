import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { userSchema } from '../schemas/userSchema';
import { PrismaClient } from '@prisma/client';
import { generateCode } from '../helpers/generateCode';
import nodemailer from 'nodemailer';
import redis, { redisClient } from '../lib/redis';
import bcrypt from 'bcrypt';
import { generateToken } from '../lib/generateToken';
import jwt, { verify } from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  const checkPassword = await bcrypt.compare(password, user?.password || '');

  if (!checkPassword) {
    res.status(400).json({ message: 'Invalid email or password.' });
    return;
  }

  if (!user?.isVerified) {
    res.status(200).json({ message: 'Logged in. Please verify your email address.' });
    return;
  }

  res.json(200).json({ message: 'Welcome back.' });
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
    const verifyToken = generateToken(email, process.env.JWT_VERIFY_TOKEN_SECRET!, '1h');

    sendVerificationCode(email);

    res.status(201).json({
      token: verifyToken,
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
  const token = req.headers.authorization?.split(' ')[1];
  const { email, code } = req.body;
  const redisKey = `verify:${email}`;
  const storedCode = await redisClient.get(redisKey);

  if (!storedCode) {
    res.status(400).json({ message: 'Your verify code is expired. Please request a new code.' });
    return;
  }

  if (!code) {
    res.status(400).json({ message: 'Invalid Code.' });
    return;
  }

  if (token) {
    const payload = jwt.verify(token, process.env.JWT_VERIFY_TOKEN_SECRET!);

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

      res.status(200).json({ message: 'Your account is verified successfully.' });
      return;
    }
  }
}

export async function resendVerificationCode(req: Request, res: Response) {
  const { email } = req.body;
  const redisKey = `verify:${email}`;
  const isCodeExisting = await redisClient.get(redisKey);

  if (isCodeExisting) {
    res.status(400).json({ message: 'Please wait before requesting a new code. Try again in a few minutes.' });
    return;
  }

  sendVerificationCode(email);

  res.status(200).json({ message: 'New verification code sent to your email.' });
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

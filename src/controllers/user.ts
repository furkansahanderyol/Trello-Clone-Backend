import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { userSchema } from '../schemas/userSchema';
import { PrismaClient } from '@prisma/client';
import { generateCode } from '../helpers/generateCode';
import nodemailer from 'nodemailer';
import redis, { redisClient } from '../lib/redis';

const prisma = new PrismaClient();

export function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = userService.login(email, password);

  res.send(JSON.stringify(user));
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
      res.status(409).json({ message: 'User already exist.' });
      return;
    }

    const user = await userService.register(name, surname, email, password);
    const newUser = await prisma.user.create({
      data: user,
    });

    sendVerificationCode(email);

    res.status(201).json({ message: 'SUCCESS', user: newUser });
    return;
  } catch (error) {
    console.error('Register-Error ->', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function registerSuccess(req: Request, res: Response) {
  const { email, code } = req.body;
  const redisKey = `verify:${email}`;
  const storedCode = await redisClient.get(redisKey);

  if (!storedCode) {
    res.status(400).json({ message: 'Test' });
    return;
  }

  if (!code) {
    res.status(400).json({ message: 'Invalid Code' });
    return;
  }

  if (code === storedCode) {
    await prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
      },
    });

    res.status(200).json({ message: 'SUCCESS' });
    return;
  }
}

export async function resendVerificationCode(req: Request, res: Response) {
  const { email } = req.body;

  sendVerificationCode(email);

  res.status(200).json({ message: 'New verification code sent to your email' });
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
    from: 'Trello <no-reply@myapp.com>',
    to: email,
    subject: 'Verification Code',
    text: `Your verification code is: ${code}`,
  });
}

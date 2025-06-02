import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { userSchema } from '../schemas/userSchema';
import { PrismaClient } from '@prisma/client';

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
  const user = await userService.register(name, email, password, surname);

  try {
    const isUserExisting = await prisma.user.findUnique({ where: { email } });

    if (isUserExisting) {
      res.status(409).json({ message: 'User already exist.' });
      return;
    }

    const newUser = await prisma.user.create({
      data: user,
    });

    res.status(201).json({ message: 'SUCCESS', user: newUser });
  } catch (error) {
    console.error(error);
  }

  res.status(201).json({ message: 'User registered successfully.' });
  return;
}

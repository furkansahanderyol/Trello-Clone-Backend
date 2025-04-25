import { Request, Response } from 'express';
import { userService } from '../services/userService';
import { userSchema } from '../schemas/userSchema';

export function post(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = userService.login(email, password);

  res.send(JSON.stringify(user));
}

export function register(req: Request, res: Response): void {
  const result = userSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      errors: result.error.flatten().fieldErrors,
    });

    return;
  }

  const { email, password, name } = result.data;

  res.status(201).json({ message: 'User registered successfully.' });

  return;
}

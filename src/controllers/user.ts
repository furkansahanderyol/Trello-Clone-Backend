import { Request, Response } from 'express';
import { userService } from '../services/userService';

export function post(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = userService.login(email, password);

  res.send(JSON.stringify(user));
}

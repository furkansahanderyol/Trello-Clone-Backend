import express, { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// const router: Router = express.Router();

export const getLogin = (req: Request, res: Response): void => {
  res.send('Login Page');
};

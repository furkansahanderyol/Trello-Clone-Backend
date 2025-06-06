import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Token missing' });
    return;
  }

  jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET!, (err, decoded) => {
    if (err) {
      res.status(403).json({ message: 'Invalid token' });
      return;
    }

    req.user = decoded as JwtPayload;
    next();
  });
}

import { serialize } from 'cookie';
import { Response } from 'express';

export function setTokenCookie(res: Response, token: string) {
  const cookie = serialize('access-token', token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    secure: false,
    sameSite: 'lax',
  });

  res.setHeader('Set-Cookie', cookie);
}

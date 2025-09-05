import { serialize } from 'cookie';
import { Response } from 'express';

export function setTokenCookie(res: Response, key: string, token: string, httpOnly: boolean) {
  const cookie = serialize(key, token, {
    httpOnly: httpOnly,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    secure: false,
    sameSite: 'lax',
  });

  const existingHeaders = res.getHeader('Set-Cookie') as string[] | string | undefined;
  if (existingHeaders) {
    if (Array.isArray(existingHeaders)) {
      res.setHeader('Set-Cookie', [...existingHeaders, cookie]);
    } else {
      res.setHeader('Set-Cookie', [existingHeaders, cookie]);
    }
  } else {
    res.setHeader('Set-Cookie', cookie);
  }
}

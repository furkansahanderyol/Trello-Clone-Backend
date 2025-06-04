import jwt, { SignOptions } from 'jsonwebtoken';

export function generateToken(email: string, token: string, expiresIn: '7d' | '1h') {
  return jwt.sign({ email: email }, token, { expiresIn: expiresIn });
}

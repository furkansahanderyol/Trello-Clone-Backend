import jwt from 'jsonwebtoken';

export function generateToken(user: { email: string; isVerified: boolean }, token: string, expiresIn: '7d' | '1h') {
  return jwt.sign({ email: user.email, isVerified: user.isVerified }, token, { expiresIn: expiresIn });
}

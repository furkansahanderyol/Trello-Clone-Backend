import jwt from 'jsonwebtoken';

export function generateToken(
  id: string,
  user: { email: string; isVerified: boolean },
  token: string,
  expiresIn: '7d' | '1h',
) {
  return jwt.sign({ id: id, email: user.email, isVerified: user.isVerified, user: user }, token, {
    expiresIn: expiresIn,
  });
}

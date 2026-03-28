import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getSetting, setSetting } from './db';

function getJwtSecret(): string {
  let secret = getSetting('jwtSecret', '');
  if (!secret) {
    secret = crypto.randomBytes(64).toString('hex');
    setSetting('jwtSecret', secret);
  }
  return secret;
}

export function signToken(username: string): string {
  return jwt.sign({ username }, getJwtSecret(), { expiresIn: '30d' });
}

export function verifyToken(token: string): { username: string } {
  return jwt.verify(token, getJwtSecret()) as { username: string };
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function checkPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    (req as any).user = verifyToken(token);
    next();
  } catch {
    res.clearCookie('auth_token');
    res.status(401).json({ error: 'Unauthorized' });
  }
}

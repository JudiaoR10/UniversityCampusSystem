import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export async function tokenFor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { role: true },
  });

  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role.code },
    process.env.JWT_ACCESS_SECRET as string,
    { expiresIn: '15m' },
  );
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function uniqueSuffix() {
  return Date.now().toString(36).slice(-5).toUpperCase();
}

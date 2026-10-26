import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { RoleCode, User } from '@prisma/client';
import { getEnv } from '../../../config/env.js';
import { prisma } from '../../../lib/prisma.js';
import { conflict, forbidden, unauthorized } from '../../../lib/errors.js';
import { audit } from '../../audit/application/auditService.js';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user: User & { role: { code: RoleCode } }) {
  const env = getEnv();
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role.code },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
  );
}

function parseDurationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const map: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * map[unit];
}

async function issueRefreshToken(userId: string) {
  const env = getEnv();
  const refreshToken = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });
  return refreshToken;
}

function toAuthUser(user: User & { role: { code: RoleCode } }) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role.code,
    isActive: user.isActive,
  };
}

export async function login(email: string, password: string, meta: { correlationId: string; ip?: string; ua?: string }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { role: true },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await audit({
      action: 'AUTH_LOGIN_FAILED',
      resource: 'User',
      correlationId: meta.correlationId,
      ipAddress: meta.ip,
      userAgent: meta.ua,
      metadata: { email },
    });
    throw unauthorized('Credenciais inválidas', 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw forbidden('Utilizador inactivo', 'USER_INACTIVE');
  }

  const env = getEnv();
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  await audit({
    action: 'AUTH_LOGIN',
    resource: 'User',
    resourceId: user.id,
    actorId: user.id,
    correlationId: meta.correlationId,
    ipAddress: meta.ip,
    userAgent: meta.ua,
  });

  return {
    user: toAuthUser(user),
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
  };
}

export async function refresh(refreshToken: string, meta: { correlationId: string }) {
  const env = getEnv();
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw unauthorized('Refresh token inválido', 'REFRESH_INVALID');
  }

  if (!stored.user.isActive) {
    throw forbidden('Utilizador inactivo', 'USER_INACTIVE');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const accessToken = signAccessToken(stored.user);
  const newRefresh = await issueRefreshToken(stored.user.id);

  await audit({
    action: 'AUTH_REFRESH',
    resource: 'User',
    resourceId: stored.userId,
    actorId: stored.userId,
    correlationId: meta.correlationId,
  });

  return {
    accessToken,
    refreshToken: newRefresh,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  };
}

export async function logout(refreshToken: string | null | undefined, actorId: string | undefined, meta: { correlationId: string }) {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await audit({
    action: 'AUTH_LOGOUT',
    resource: 'User',
    resourceId: actorId,
    actorId,
    correlationId: meta.correlationId,
  });

  return { ok: true as const };
}

export async function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: RoleCode;
}, actorId: string, correlationId: string) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw conflict('USER_EXISTS', 'Email já registado');

  const role = await prisma.role.findUnique({ where: { code: input.role } });
  if (!role) throw conflict('ROLE_NOT_FOUND', 'Role inexistente');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      passwordHash,
      roleId: role.id,
    },
    include: { role: true },
  });

  await audit({
    action: 'USER_CREATE',
    resource: 'User',
    resourceId: user.id,
    actorId,
    correlationId,
    metadata: { email: user.email, role: user.role.code },
  });

  return toAuthUser(user);
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { fullName: 'asc' },
  });
  return users.map(toAuthUser);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) throw unauthorized();
  return toAuthUser(user);
}

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized();
    }
    const token = header.slice(7);
    const env = getEnv();
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw unauthorized('Utilizador inactivo ou inexistente', 'USER_INACTIVE');
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role.code,
    };
    next();
  } catch (err) {
    if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
      next(unauthorized('Token inválido ou expirado', 'TOKEN_INVALID'));
      return;
    }
    next(err);
  }
}

export async function authenticateIngest(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('x-device-token') ?? req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : header?.trim();
    if (!token) {
      throw unauthorized('Token de dispositivo em falta', 'DEVICE_TOKEN_MISSING');
    }
    const env = getEnv();
    if (env.INGEST_API_KEY && token === env.INGEST_API_KEY) {
      req.ingest = { actorId: null, sensorCode: 'CAM-LPR-API' };
      next();
      return;
    }
    const device = await prisma.device.findUnique({ where: { ingestToken: token } });
    if (!device) {
      throw unauthorized('Token de dispositivo inválido', 'DEVICE_TOKEN_INVALID');
    }
    req.ingest = { actorId: null, sensorCode: device.code };
    next();
  } catch (err) {
    next(err);
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      next(forbidden(`Role ${req.user.role} sem permissão para esta operação`));
      return;
    }
    next();
  };
}

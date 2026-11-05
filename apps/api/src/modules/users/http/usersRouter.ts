import { Router } from 'express';
import { createUserSchema, updateUserSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as authService from '../../auth/application/authService.js';

export const usersRouter = Router();

usersRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const me = await authService.getMe(req.user!.id);
    success(res, me);
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/users', authenticate, authorize('ADMIN', 'COORDINATOR'), async (_req, res, next) => {
  try {
    const users = await authService.listUsers();
    success(res, users);
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/users', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    const user = await authService.createUser(body, req.user!.id, req.correlationId);
    success(res, user, 201);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/users/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await authService.updateUser(req.params.id, body, req.user!.id, req.correlationId);
    success(res, user);
  } catch (err) {
    next(err);
  }
});

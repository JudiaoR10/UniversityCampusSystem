import { Router } from 'express';
import {
  batchCreateCourseWithSubjectsSchema,
  createCourseSchema,
  createDepartmentSchema,
  createSubjectSchema,
  updateCourseSchema,
  updateSubjectSchema,
} from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as academic from '../application/academicService.js';

export const academicRouter = Router();

const WRITE = authorize('ADMIN', 'COORDINATOR');
const queryString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

// ---- Departamentos ----
academicRouter.get('/departments', authenticate, async (_req, res, next) => {
  try {
    success(res, await academic.listDepartments());
  } catch (err) {
    next(err);
  }
});

academicRouter.get('/departments/:id', authenticate, async (req, res, next) => {
  try {
    success(res, await academic.getDepartment(req.params.id));
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/departments', authenticate, WRITE, async (req, res, next) => {
  try {
    const body = createDepartmentSchema.parse(req.body);
    success(res, await academic.createDepartment(body, req.user!.id, req.correlationId), 201);
  } catch (err) {
    next(err);
  }
});

academicRouter.delete('/departments/:id', authenticate, WRITE, async (req, res, next) => {
  try {
    await academic.deleteDepartment(req.params.id, req.user!.id, req.correlationId);
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Cursos ----
academicRouter.get('/courses', authenticate, async (req, res, next) => {
  try {
    success(res, await academic.listCourses(queryString(req.query.departmentId)));
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/courses', authenticate, WRITE, async (req, res, next) => {
  try {
    const body = createCourseSchema.parse(req.body);
    success(res, await academic.createCourse(body, req.user!.id, req.correlationId), 201);
  } catch (err) {
    next(err);
  }
});

academicRouter.patch('/courses/:id', authenticate, WRITE, async (req, res, next) => {
  try {
    const body = updateCourseSchema.parse(req.body);
    success(res, await academic.updateCourse(req.params.id, body, req.user!.id, req.correlationId));
  } catch (err) {
    next(err);
  }
});

academicRouter.delete('/courses/:id', authenticate, WRITE, async (req, res, next) => {
  try {
    await academic.deleteCourse(req.params.id, req.user!.id, req.correlationId);
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/courses/batch-with-subjects', authenticate, WRITE, async (req, res, next) => {
  try {
    const body = batchCreateCourseWithSubjectsSchema.parse(req.body);
    success(res, await academic.createCourseWithSubjects(body, req.user!.id, req.correlationId), 201);
  } catch (err) {
    next(err);
  }
});

academicRouter.get('/courses/:courseId/subjects', authenticate, async (req, res, next) => {
  try {
    success(res, await academic.listSubjectsOfCourse(req.params.courseId));
  } catch (err) {
    next(err);
  }
});

// ---- Disciplinas ----
academicRouter.get('/subjects', authenticate, async (req, res, next) => {
  try {
    success(res, await academic.listSubjects(queryString(req.query.courseId)));
  } catch (err) {
    next(err);
  }
});

academicRouter.post('/subjects', authenticate, WRITE, async (req, res, next) => {
  try {
    const body = createSubjectSchema.parse(req.body);
    success(res, await academic.createSubject(body, req.user!.id, req.correlationId), 201);
  } catch (err) {
    next(err);
  }
});

academicRouter.delete('/subjects/:id', authenticate, WRITE, async (req, res, next) => {
  try {
    await academic.deleteSubject(req.params.id, req.user!.id, req.correlationId);
    success(res, { ok: true });
  } catch (err) {
    next(err);
  }
});

academicRouter.patch('/subjects/:id', authenticate, WRITE, async (req, res, next) => {
  try {
    const body = updateSubjectSchema.parse(req.body);
    success(res, await academic.updateSubject(req.params.id, body, req.user!.id, req.correlationId));
  } catch (err) {
    next(err);
  }
});
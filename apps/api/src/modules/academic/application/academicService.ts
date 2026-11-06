import { Prisma } from '@prisma/client';
import type {
  BatchCreateCourseWithSubjectsInput,
  CreateCourseInput,
  CreateDepartmentInput,
  CreateSubjectInput,
  UpdateCourseInput,
  UpdateSubjectInput,
} from '@smart-campus/validation';
import { AppError, conflict, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

const ref = { select: { id: true, code: true, name: true } } as const;

const withDates = <T extends { createdAt: Date; updatedAt: Date }>(row: T) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const isDuplicate = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

// ---- Departamentos ----
export async function listDepartments() {
  const rows = await prisma.department.findMany({ orderBy: { code: 'asc' } });
  return rows.map(withDates);
}

export async function getDepartment(id: string) {
  const row = await prisma.department.findUnique({ where: { id } });
  if (!row) throw notFound('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado');
  return withDates(row);
}

export async function createDepartment(input: CreateDepartmentInput, actorId: string, correlationId: string) {
  try {
    const row = await prisma.department.create({ data: input });
    await audit({
      action: 'DEPARTMENT_CREATE',
      resource: 'Department',
      resourceId: row.id,
      actorId,
      correlationId,
      metadata: { code: row.code },
    });
    return withDates(row);
  } catch (err) {
    if (isDuplicate(err)) {
      throw conflict('DEPARTMENT_CODE_EXISTS', `Já existe um departamento com o código '${input.code}'`);
    }
    throw err;
  }
}

export async function deleteDepartment(id: string, actorId: string, correlationId: string) {
  await getDepartment(id);
  const [courses, teachers] = await Promise.all([
    prisma.course.count({ where: { departmentId: id } }),
    prisma.teacherProfile.count({ where: { departmentId: id } }),
  ]);
  if (courses > 0 || teachers > 0) {
    throw new AppError(
      'BUSINESS_RULE_VIOLATION',
      `Não é possível eliminar: ${courses} curso(s) e ${teachers} docente(s) associados.`,
      400,
    );
  }
  await prisma.department.delete({ where: { id } });
  await audit({ action: 'DEPARTMENT_DELETE', resource: 'Department', resourceId: id, actorId, correlationId });
}

// ---- Cursos ----
export async function listCourses(departmentId?: string) {
  const rows = await prisma.course.findMany({
    where: departmentId ? { departmentId } : undefined,
    include: { department: ref },
    orderBy: { code: 'asc' },
  });
  return rows.map(withDates);
}

export async function createCourse(input: CreateCourseInput, actorId: string, correlationId: string) {
  if (!(await prisma.department.findUnique({ where: { id: input.departmentId } }))) {
    throw notFound('DEPARTMENT_NOT_FOUND', 'Departamento associado não encontrado');
  }
  try {
    const row = await prisma.course.create({ data: input, include: { department: ref } });
    await audit({
      action: 'COURSE_CREATE',
      resource: 'Course',
      resourceId: row.id,
      actorId,
      correlationId,
      metadata: { code: row.code },
    });
    return withDates(row);
  } catch (err) {
    if (isDuplicate(err)) {
      throw conflict('COURSE_CODE_EXISTS', `Já existe um curso com o código '${input.code}'`);
    }
    throw err;
  }
}

export async function updateCourse(id: string, input: UpdateCourseInput, actorId: string, correlationId: string) {
  if (!(await prisma.course.findUnique({ where: { id } }))) {
    throw notFound('COURSE_NOT_FOUND', 'Curso não encontrado');
  }
  if (input.departmentId && !(await prisma.department.findUnique({ where: { id: input.departmentId } }))) {
    throw notFound('DEPARTMENT_NOT_FOUND', 'Departamento associado não encontrado');
  }
  try {
    const row = await prisma.course.update({ where: { id }, data: input, include: { department: ref } });
    await audit({
      action: 'COURSE_UPDATE',
      resource: 'Course',
      resourceId: id,
      actorId,
      correlationId,
      metadata: { code: row.code, fields: Object.keys(input) },
    });
    return withDates(row);
  } catch (err) {
    if (isDuplicate(err)) {
      throw conflict('COURSE_CODE_EXISTS', `Já existe um curso com o código '${input.code}'`);
    }
    throw err;
  }
}

export async function deleteCourse(id: string, actorId: string, correlationId: string) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw notFound('COURSE_NOT_FOUND', 'Curso não encontrado');
  const [subjects, students, enrolments] = await Promise.all([
    prisma.subject.count({ where: { courseId: id } }),
    prisma.studentProfile.count({ where: { courseId: id } }),
    prisma.enrolment.count({ where: { courseId: id } }),
  ]);
  if (subjects > 0 || students > 0 || enrolments > 0) {
    throw new AppError(
      'BUSINESS_RULE_VIOLATION',
      `Não é possível eliminar: ${subjects} disciplina(s), ${students} estudante(s) e ${enrolments} matrícula(s) associados.`,
      400,
    );
  }
  await prisma.course.delete({ where: { id } });
  await audit({
    action: 'COURSE_DELETE',
    resource: 'Course',
    resourceId: id,
    actorId,
    correlationId,
    metadata: { code: course.code },
  });
}

// ---- Disciplinas ----
export async function listSubjects(courseId?: string) {
  const rows = await prisma.subject.findMany({
    where: courseId ? { courseId } : undefined,
    include: { course: ref },
    orderBy: { code: 'asc' },
  });
  return rows.map(withDates);
}

export async function listSubjectsOfCourse(courseId: string) {
  if (!(await prisma.course.findUnique({ where: { id: courseId } }))) {
    throw notFound('COURSE_NOT_FOUND', 'Curso não encontrado');
  }
  return listSubjects(courseId);
}

export async function createSubject(input: CreateSubjectInput, actorId: string, correlationId: string) {
  if (!(await prisma.course.findUnique({ where: { id: input.courseId } }))) {
    throw notFound('COURSE_NOT_FOUND', 'Curso associado não encontrado');
  }
  try {
    const row = await prisma.subject.create({ data: input, include: { course: ref } });
    await audit({
      action: 'SUBJECT_CREATE',
      resource: 'Subject',
      resourceId: row.id,
      actorId,
      correlationId,
      metadata: { code: row.code },
    });
    return withDates(row);
  } catch (err) {
    if (isDuplicate(err)) {
      throw conflict('SUBJECT_CODE_EXISTS', `Já existe uma disciplina com o código '${input.code}'`);
    }
    throw err;
  }
}

export async function updateSubject(id: string, input: UpdateSubjectInput, actorId: string, correlationId: string) {
  if (!(await prisma.subject.findUnique({ where: { id } }))) {
    throw notFound('SUBJECT_NOT_FOUND', 'Disciplina não encontrada');
  }
  if (input.courseId && !(await prisma.course.findUnique({ where: { id: input.courseId } }))) {
    throw notFound('COURSE_NOT_FOUND', 'Curso associado não encontrado');
  }
  try {
    const row = await prisma.subject.update({ where: { id }, data: input, include: { course: ref } });
    await audit({
      action: 'SUBJECT_UPDATE',
      resource: 'Subject',
      resourceId: id,
      actorId,
      correlationId,
      metadata: { code: row.code, fields: Object.keys(input) },
    });
    return withDates(row);
  } catch (err) {
    if (isDuplicate(err)) {
      throw conflict('SUBJECT_CODE_EXISTS', `Já existe uma disciplina com o código '${input.code}'`);
    }
    throw err;
  }
}

export async function deleteSubject(id: string, actorId: string, correlationId: string) {
  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject) throw notFound('SUBJECT_NOT_FOUND', 'Disciplina não encontrada');
  await prisma.subject.delete({ where: { id } });
  await audit({
    action: 'SUBJECT_DELETE',
    resource: 'Subject',
    resourceId: id,
    actorId,
    correlationId,
    metadata: { code: subject.code },
  });
}

// ---- Transação atómica: curso + disciplinas ----
export async function createCourseWithSubjects(
  input: BatchCreateCourseWithSubjectsInput,
  actorId: string,
  correlationId: string,
) {
  if (!(await prisma.department.findUnique({ where: { id: input.course.departmentId } }))) {
    throw notFound('DEPARTMENT_NOT_FOUND', 'Departamento associado não encontrado');
  }
  try {
    const out = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({ data: input.course, include: { department: ref } });
      const subjects = [];
      for (const subject of input.subjects) {
        subjects.push(
          await tx.subject.create({ data: { ...subject, courseId: course.id }, include: { course: ref } }),
        );
      }
      return { course, subjects };
    });
    await audit({
      action: 'COURSE_BATCH_CREATE',
      resource: 'Course',
      resourceId: out.course.id,
      actorId,
      correlationId,
      metadata: { code: out.course.code, subjects: out.subjects.length },
    });
    return { course: withDates(out.course), subjects: out.subjects.map(withDates) };
  } catch (err) {
    if (isDuplicate(err)) {
      throw conflict('DUPLICATE_CODE', 'Código duplicado: nada foi gravado (rollback).');
    }
    throw err;
  }
}
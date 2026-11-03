import type { StudentProfileStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

const courseRef = { select: { id: true, code: true, name: true } } as const;
const userRef = { select: { id: true, fullName: true } } as const;

export type CreateStudentAccountData = {
  email: string;
  passwordHash: string;
  fullName: string;
  roleId: string;
  studentNumber: string;
  courseId: string;
  yearOfStudy?: number | null;
  phone?: string | null;
};

export type UpdateStudentData = {
  courseId?: string;
  yearOfStudy?: number | null;
  phone?: string | null;
  status?: StudentProfileStatus;
};

export async function listStudents(filters: { courseId?: string; status?: StudentProfileStatus }) {
  return prisma.studentProfile.findMany({
    where: { courseId: filters.courseId, status: filters.status },
    include: { course: courseRef, user: userRef },
    orderBy: { studentNumber: 'asc' },
  });
}

export async function findStudentById(id: string) {
  return prisma.studentProfile.findUnique({
    where: { id },
    include: { course: courseRef, user: userRef },
  });
}

export async function findStudentByUserId(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    include: { course: courseRef, user: userRef },
  });
}

export async function findStudentByStudentNumber(studentNumber: string) {
  return prisma.studentProfile.findUnique({
    where: { studentNumber },
    select: { id: true },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } });
}

export async function findRoleByCode(code: 'STUDENT') {
  return prisma.role.findUnique({ where: { code }, select: { id: true, code: true } });
}

export async function findCourseById(id: string) {
  return prisma.course.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  });
}

// Conta (User) + perfil numa única transacção: se o perfil falhar, o User é revertido.
export async function createStudentAccount(data: CreateStudentAccountData) {
  const { email, passwordHash, fullName, roleId, ...profile } = data;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, fullName, roleId },
      select: { id: true },
    });

    return tx.studentProfile.create({
      data: { ...profile, userId: user.id },
      include: { course: courseRef, user: userRef },
    });
  });
}

export async function updateStudent(id: string, data: UpdateStudentData) {
  return prisma.studentProfile.update({
    where: { id },
    data,
    include: { course: courseRef, user: userRef },
  });
}

// Remove a conta (User) e o perfil em conjunto: a conta não pode ficar órfã a permitir login.
// O perfil é apagado por cascade; devolve null quando o estudante tem inscrições.
export async function deleteStudentAccount(id: string) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.studentProfile.findFirst({
      where: { id, enrolments: { none: {} }, subjectEnrolments: { none: {} } },
      select: { id: true, userId: true },
    });
    if (!profile) return null;

    await tx.user.delete({ where: { id: profile.userId } });
    return profile;
  });
}

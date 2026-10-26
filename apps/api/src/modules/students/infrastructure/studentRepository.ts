import type { StudentProfileStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

const courseRef = { select: { id: true, code: true, name: true } } as const;
const userRef = { select: { id: true, fullName: true } } as const;

export type CreateStudentData = {
  userId: string;
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

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

export async function findCourseById(id: string) {
  return prisma.course.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  });
}

export async function createStudent(data: CreateStudentData) {
  return prisma.studentProfile.create({
    data,
    include: { course: courseRef, user: userRef },
  });
}

export async function updateStudent(id: string, data: UpdateStudentData) {
  return prisma.studentProfile.update({
    where: { id },
    data,
    include: { course: courseRef, user: userRef },
  });
}

export async function deleteStudentWithoutEnrolments(id: string) {
  const result = await prisma.studentProfile.deleteMany({
    where: { id, enrolments: { none: {} }, subjectEnrolments: { none: {} } },
  });
  return result.count;
}

import type { EnrolmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

const subjectRef = { select: { id: true, code: true, name: true } } as const;
const studentRef = {
  select: {
    id: true,
    studentNumber: true,
    user: { select: { fullName: true } },
  },
} as const;

export async function listEnrolments(where: Prisma.SubjectEnrolmentWhereInput) {
  return prisma.subjectEnrolment.findMany({
    where,
    include: { student: studentRef, subject: subjectRef },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findEnrolmentById(id: string) {
  return prisma.subjectEnrolment.findUnique({
    where: { id },
    include: { student: studentRef, subject: subjectRef },
  });
}

export async function findEnrolmentByUniqueKey(
  studentId: string,
  subjectId: string,
  academicYear: number,
) {
  return prisma.subjectEnrolment.findUnique({
    where: { studentId_subjectId_academicYear: { studentId, subjectId, academicYear } },
    select: { id: true },
  });
}

export async function findStudentById(id: string) {
  return prisma.studentProfile.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, courseId: true },
  });
}

export async function findStudentByUserId(userId: string) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
}

export async function findSubjectById(id: string) {
  return prisma.subject.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, courseId: true },
  });
}

export async function createEnrolment(data: {
  studentId: string;
  subjectId: string;
  academicYear: number;
}) {
  return prisma.subjectEnrolment.create({
    data,
    include: { student: studentRef, subject: subjectRef },
  });
}

export async function updateEnrolmentStatus(id: string, status: EnrolmentStatus) {
  return prisma.subjectEnrolment.update({
    where: { id },
    data: { status },
    include: { student: studentRef, subject: subjectRef },
  });
}

export async function deleteEnrolment(id: string) {
  return prisma.subjectEnrolment.delete({ where: { id } });
}

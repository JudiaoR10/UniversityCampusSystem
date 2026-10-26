import type { TeacherProfileStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

const departmentRef = { select: { id: true, code: true, name: true } } as const;
const userRef = { select: { id: true, fullName: true } } as const;

export type CreateTeacherData = {
  userId: string;
  employeeCode: string;
  departmentId: string;
  title?: string | null;
  phone?: string | null;
};

export type UpdateTeacherData = {
  departmentId?: string;
  title?: string | null;
  phone?: string | null;
  status?: TeacherProfileStatus;
};

export async function listTeachers(filters: { departmentId?: string; status?: TeacherProfileStatus }) {
  return prisma.teacherProfile.findMany({
    where: { departmentId: filters.departmentId, status: filters.status },
    include: { department: departmentRef, user: userRef },
    orderBy: { employeeCode: 'asc' },
  });
}

export async function findTeacherById(id: string) {
  return prisma.teacherProfile.findUnique({
    where: { id },
    include: { department: departmentRef, user: userRef },
  });
}

export async function findTeacherByUserId(userId: string) {
  return prisma.teacherProfile.findUnique({
    where: { userId },
    include: { department: departmentRef, user: userRef },
  });
}

export async function findTeacherByEmployeeCode(employeeCode: string) {
  return prisma.teacherProfile.findUnique({
    where: { employeeCode },
    select: { id: true },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

export async function findDepartmentById(id: string) {
  return prisma.department.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  });
}

export async function createTeacher(data: CreateTeacherData) {
  return prisma.teacherProfile.create({
    data,
    include: { department: departmentRef, user: userRef },
  });
}

export async function updateTeacher(id: string, data: UpdateTeacherData) {
  return prisma.teacherProfile.update({
    where: { id },
    data,
    include: { department: departmentRef, user: userRef },
  });
}

export async function deleteTeacher(id: string) {
  return prisma.teacherProfile.delete({ where: { id } });
}

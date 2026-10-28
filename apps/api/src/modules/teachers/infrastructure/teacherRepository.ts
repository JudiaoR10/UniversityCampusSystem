import type { TeacherProfileStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma.js';

const departmentRef = { select: { id: true, code: true, name: true } } as const;
const userRef = { select: { id: true, fullName: true } } as const;

export type CreateTeacherAccountData = {
  email: string;
  passwordHash: string;
  fullName: string;
  roleId: string;
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

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } });
}

export async function findRoleByCode(code: 'TEACHER') {
  return prisma.role.findUnique({ where: { code }, select: { id: true, code: true } });
}

export async function findDepartmentById(id: string) {
  return prisma.department.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  });
}

// Conta (User) + perfil numa única transacção: se o perfil falhar, o User é revertido.
export async function createTeacherAccount(data: CreateTeacherAccountData) {
  const { email, passwordHash, fullName, roleId, ...profile } = data;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, fullName, roleId },
      select: { id: true },
    });

    return tx.teacherProfile.create({
      data: { ...profile, userId: user.id },
      include: { department: departmentRef, user: userRef },
    });
  });
}

export async function updateTeacher(id: string, data: UpdateTeacherData) {
  return prisma.teacherProfile.update({
    where: { id },
    data,
    include: { department: departmentRef, user: userRef },
  });
}

// Remove a conta (User) e o perfil em conjunto: a conta não pode ficar órfã a permitir login.
// O perfil é apagado por cascade.
export async function deleteTeacherAccount(id: string) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.teacherProfile.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!profile) return null;

    await tx.user.delete({ where: { id: profile.userId } });
    return profile;
  });
}

import type { StudentProfileStatus } from '@prisma/client';
import { AppError } from '../../../lib/errors.js';

export function assertActiveForEnrolment(status: StudentProfileStatus) {
  if (status !== 'ACTIVE') {
    throw new AppError(
      'STUDENT_NOT_ACTIVE',
      'O estudante não está activo e não pode ser inscrito em disciplinas',
      409,
    );
  }
}

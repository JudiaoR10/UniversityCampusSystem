import type { EnrolmentStatus } from '@prisma/client';
import { conflict } from '../../../lib/errors.js';

const allowedTransitions: Record<EnrolmentStatus, EnrolmentStatus[]> = {
  PENDING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertCanTransition(current: EnrolmentStatus, next: EnrolmentStatus) {
  if (!allowedTransitions[current].includes(next)) {
    throw conflict(
      'INVALID_STATUS_TRANSITION',
      `Não é possível mudar de ${current} para ${next}`,
    );
  }
}

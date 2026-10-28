import { z } from 'zod';
import {
  isValidMozambiquePlate,
  MOZAMBIQUE_PLATE_MESSAGE,
  normalizeMozambiquePlate,
} from './mozambiquePlate.js';

export * from './mozambiquePlate.js';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Password deve ter pelo menos 8 caracteres'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, 'Refresh token inválido'),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  role: z.enum(['STUDENT', 'TEACHER', 'TECHNICIAN', 'COORDINATOR', 'ADMIN', 'FINANCE']),
});

export const createRoomSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  capacity: z.number().int().positive().max(1000),
  floor: z.number().int().min(-5).max(100).default(0),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED']).optional(),
  buildingId: z.string().min(1),
});

export const createBuildingSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  floors: z.number().int().min(0).max(200).default(1),
});

export const createLaboratorySchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  buildingId: z.string().min(1),
});

export const createIncidentSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  roomId: z.string().optional().nullable(),
  equipmentId: z.string().optional().nullable(),
});

export const createEquipmentSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  roomId: z.string().optional().nullable(),
  laboratoryId: z.string().optional().nullable(),
});

export const updateIncidentStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  notes: z.string().max(1000).optional(),
  assigneeId: z.string().optional().nullable(),
});

const mozambiquePlateSchema = z
  .string()
  .min(8)
  .max(14)
  .transform(normalizeMozambiquePlate)
  .refine(isValidMozambiquePlate, { message: MOZAMBIQUE_PLATE_MESSAGE });

export const createPlateReadingSchema = z.object({
  lotId: z.string().min(1),
  plate: mozambiquePlateSchema,
  direction: z.enum(['IN', 'OUT']),
  sensorCode: z.string().min(2).max(64).default('CAM-LPR-SIM'),
  confidence: z.number().min(0).max(1).default(0.9),
  photoUrl: z.string().url().optional().nullable(),
  spotCode: z.string().min(2).max(16).optional().nullable(),
});

export const updateParkingSpotSchema = z.object({
  status: z.enum(['FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE']),
  plate: mozambiquePlateSchema.optional().nullable(),
});
export const createDeviceSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  type: z.string().min(2).max(60),
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE', 'UNKNOWN']).optional(),
  roomId: z.string().optional().nullable(),
  mqttTopic: z.string().max(200).optional().nullable(),
});

export const updateDeviceSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    type: z.string().trim().min(2).max(50).optional(),
    roomId: z.string().min(1).nullable().optional(),
    mqttTopic: z.string().trim().max(200).nullable().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: 'Envie pelo menos um campo para actualizar',
  });


export const updateDeviceStatusSchema = z.object({
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE', 'UNKNOWN']),
});

const assessmentTypeSchema = z.enum(['TEST','EXAM','ASSIGNMENT','PRACTICAL','ORAL','OTHER','RECURRENCE']);
const gradingModeSchema = z.enum(['PERCENTAGE','POINTS','SCALE']);
export const createAssessmentSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional().or(z.null()),
  subjectId: z.string().min(1),
  type: assessmentTypeSchema.optional().default('TEST'),
  gradingMode: gradingModeSchema.optional().default('PERCENTAGE'),
  maxScore: z.number().positive().max(1000).optional(),
  weight: z.number().positive().max(100).optional().or(z.literal(100)),
  date: z.coerce.date().optional().or(z.null()),
});

export const updateAssessmentSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().max(500).optional().or(z.null()),
  type: assessmentTypeSchema.optional(),
  gradingMode: gradingModeSchema.optional(),
  maxScore: z.number().positive().max(1000).optional(),
  weight: z.number().positive().max(100).optional().or(z.literal(100)),
  date: z.coerce.date().optional().or(z.null()),
});

export const setRequiredTestCountSchema = z.object({
  requiredTestCount: z.number().int().min(1).max(20).nullable(),
});

export const setSubjectRulesSchema = z
  .object({
    requiredTestCount: z.number().int().min(1).max(20).nullable().optional(),
    recurrenceMinAdmission: z.number().min(0).max(20).nullable().optional(),
  })
  .refine((v) => v.requiredTestCount !== undefined || v.recurrenceMinAdmission !== undefined, {
    message: 'Indique requiredTestCount e/ou recurrenceMinAdmission',
  });

export const publishResultsSchema = z.object({
  published: z.boolean(),
});

export const upsertGradesSchema = z.object({
  grades: z
    .array(
      z.object({
        studentId: z.string().min(1),
        value: z.number(),
        comment: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1)
    .max(200),
});

export const createResultSchema = z.object({
  assessmentId: z.string().min(1),
  studentId: z.string().min(1),
  value: z.number(),
  comment: z.string().max(500).optional().nullable(),
});

const scheduleBase = {
  title: z.string().min(3).max(160),
  subjectId: z.string().min(1),
  courseId: z.string().min(1),
  teacherId: z.string().min(1).optional().nullable(),
  roomId: z.string().min(1).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
};

export const createScheduleSchema = z
  .object(scheduleBase)
  .refine((s) => s.endsAt.getTime() > s.startsAt.getTime(), {
    message: 'endsAt deve ser posterior a startsAt',
    path: ['endsAt'],
  });

export const updateScheduleSchema = z
  .object({
    title: scheduleBase.title.optional(),
    subjectId: scheduleBase.subjectId.optional(),
    courseId: scheduleBase.courseId.optional(),
    teacherId: scheduleBase.teacherId,
    roomId: scheduleBase.roomId,
    startsAt: scheduleBase.startsAt.optional(),
    endsAt: scheduleBase.endsAt.optional(),
  })
  .refine(
    (s) => {
      if (s.startsAt && s.endsAt) return s.endsAt.getTime() > s.startsAt.getTime();
      return true;
    },
    { message: 'endsAt deve ser posterior a startsAt', path: ['endsAt'] },
  );

export const attendanceStatusSchema = z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']);

export const markAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: attendanceStatusSchema,
        note: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1)
    .max(300),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type CreateLaboratoryInput = z.infer<typeof createLaboratorySchema>;
export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentStatusInput = z.infer<typeof updateIncidentStatusSchema>;
export type CreatePlateReadingInput = z.infer<typeof createPlateReadingSchema>;
export type UpdateParkingSpotInput = z.infer<typeof updateParkingSpotSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type SetRequiredTestCountInput = z.infer<typeof setRequiredTestCountSchema>;
export type SetSubjectRulesInput = z.infer<typeof setSubjectRulesSchema>;
export type PublishResultsInput = z.infer<typeof publishResultsSchema>;
export type UpsertGradesInput = z.infer<typeof upsertGradesSchema>;
export type CreateResultInput = z.infer<typeof createResultSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

const financialAmountSchema = z
  .number()
  .positive('O valor deve ser superior a zero')
  .max(1000000, 'Valor limite excedido por transacao')
  .refine((value) => value === Math.round(value * 100) / 100, 'Use no maximo duas casas decimais');

// Schema de criacao de Divida (usado em POST /api/v1/financial/debts)
export const createDebtSchema = z.object({
  studentId: z.string().min(1, 'O ID do estudante e obrigatorio'),
  title: z.string().trim().min(3, 'Titulo deve ter pelo menos 3 caracteres').max(120),
  description: z.string().trim().max(500).optional(),
  amount: financialAmountSchema,
  origin: z.string().trim().min(2, 'Origem e obrigatoria').max(60),
  dueDate: z
    .string()
    .datetime({ message: 'Data de vencimento invalida (formato ISO 8601 obrigatorio)' }),
});

// Schema de registo de Pagamento (usado em POST /api/v1/financial/payments)
export const createPaymentSchema = z.object({
  debtId: z.string().min(1, 'ID da divida e obrigatorio'),
  amountPaid: financialAmountSchema,
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH_DEPOSIT', 'MOBILE_MONEY', 'POS'], {
    errorMap: () => ({ message: 'Metodo de pagamento invalido' }),
  }),
  referenceCode: z
    .string()
    .trim()
    .min(4, 'Codigo de referencia invalido (minimo 4 caracteres)')
    .max(80),
});

// Schema de contestacao de Divida (usado em POST /api/v1/financial/analysis-requests)
export const createAnalysisRequestSchema = z.object({
  debtId: z.string().min(1, 'ID da divida e obrigatorio'),
  reason: z.string().trim().min(10, 'A justificacao deve ter pelo menos 10 caracteres').max(1000),
});

// Schema de resolucao de contestacao (usado em PATCH /api/v1/financial/analysis-requests/:id)
export const resolveAnalysisRequestSchema = z.object({
  decision: z.enum(['PROCEDENTE', 'IMPROCEDENTE'], {
    errorMap: () => ({ message: 'Decisao invalida: use PROCEDENTE ou IMPROCEDENTE' }),
  }),
  resolutionNotes: z.string().trim().min(5, 'A nota de resolucao e obrigatoria').max(1000),
});

// Schema de actualizacao da Politica Financeira (usado em PATCH /api/v1/financial/policies/:id)
export const updateFinancialPolicySchema = z.object({
  gracePeriodDays: z.number().int().min(0).max(60),
  autoBlockEnabled: z.boolean(),
  maxDebtAmount: z
    .number()
    .min(0)
    .max(1000000)
    .refine(
      (value) => value === Math.round(value * 100) / 100,
      'Use no maximo duas casas decimais',
    ),
});

// Inferred types — modulo financeiro
export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateAnalysisRequestInput = z.infer<typeof createAnalysisRequestSchema>;
export type ResolveAnalysisRequestInput = z.infer<typeof resolveAnalysisRequestSchema>;
export type UpdateFinancialPolicyInput = z.infer<typeof updateFinancialPolicySchema>;

// Consulta/reenvio de um aviso existente; nao permite destinatarios ou URLs arbitrarios.
export const financialNotificationIdSchema = z.object({
  notificationId: z.string().trim().min(1).max(200),
});
export const retryFinancialNotificationSchema = z.object({}).strict();

// Paginas limitadas protegem a API de consultas sem limite e queries ambiguas.
export const paginationQuerySchema = z.object({
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(100000))
    .optional()
    .default('0'),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default('50'),
});
export const financialPageSchema = paginationQuerySchema;
export const financialDebtQuerySchema = financialPageSchema.extend({
  studentId: z.string().trim().min(1).max(200).optional(),
});

const financialReadPageSchema = paginationQuerySchema.extend({
  limit: paginationQuerySchema.shape.limit.default('20'),
});
export const financialStudentQuerySchema = financialReadPageSchema.extend({
  q: z.string().trim().min(2).max(100).optional(),
});
export const financialAnalysisQuerySchema = financialReadPageSchema.extend({
  status: z.enum(['PENDENTE_ANALISE', 'PROCEDENTE', 'IMPROCEDENTE']).optional(),
  studentId: z.string().trim().min(1).max(200).optional(),
  debtId: z.string().trim().min(1).max(200).optional(),
});
export const financialAnalysisIdSchema = z.object({
  id: z.string().trim().min(1).max(200),
});
export type FinancialStudentQuery = z.infer<typeof financialStudentQuerySchema>;
export type FinancialAnalysisQuery = z.infer<typeof financialAnalysisQuerySchema>;

export const financialMonthSchema = z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/, 'Use um mês válido no formato AAAA-MM (2000–2100)');
export const monthlyReportQuerySchema = z.object({ month: financialMonthSchema }).strict();
export const salaryQuerySchema = financialReadPageSchema.extend({ month: financialMonthSchema });
export const createSalarySchema = z.object({
  teacherId: z.string().trim().min(1).max(200),
  month: financialMonthSchema,
  amount: financialAmountSchema,
  notes: z.string().trim().max(500).default(''),
}).strict();
export const updateSalarySchema = createSalarySchema.pick({ amount: true, notes: true }).extend({
  expectedUpdatedAt: z.string().datetime(),
}).strict();
export const salaryPaymentSchema = createPaymentSchema.omit({ debtId: true }).extend({
  expectedUpdatedAt: z.string().datetime(),
}).strict();
export type CreateSalaryInput = z.infer<typeof createSalarySchema>;
export type UpdateSalaryInput = z.infer<typeof updateSalarySchema>;
export type SalaryPaymentInput = z.infer<typeof salaryPaymentSchema>;
export type SalaryQuery = z.infer<typeof salaryQuerySchema>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceStatusInput = z.infer<typeof updateDeviceStatusSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

// Schemas do módulo academic (preservado do upstream — grupo académico)
export const createDepartmentSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(3).max(120),
  description: z.string().max(500).optional(),
});

export const createCourseSchema = z.object({
  code: z.string().trim().min(2).max(10),
  name: z.string().trim().min(3).max(120),
  description: z.string().max(500).optional(),
  departmentId: z.string().min(1, 'Departamento obrigatório'),
});

export const createSubjectSchema = z.object({
  code: z.string().trim().min(2).max(10),
  name: z.string().trim().min(3).max(120),
  credits: z.number().int().positive(),
  courseId: z.string().min(1, 'Curso obrigatório'),
});

export const batchCreateCourseWithSubjectsSchema = z.object({
  course: createCourseSchema,
  subjects: z.array(createSubjectSchema.omit({ courseId: true })).min(1),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type BatchCreateCourseWithSubjectsInput = z.infer<typeof batchCreateCourseWithSubjectsSchema>;

const idSchema = z.string().trim().min(1).max(64);
const phoneSchema = z.string().trim().min(6).max(30);

export const studentProfileStatusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'GRADUATED', 'WITHDRAWN']);

const accountEmailSchema = z.string().trim().toLowerCase().email('Email inválido');
const accountPasswordSchema = z
  .string()
  .min(8, 'Password deve ter pelo menos 8 caracteres')
  .max(128);
const accountNameSchema = z.string().trim().min(2).max(120);

export const createStudentProfileSchema = z.object({
  email: accountEmailSchema,
  password: accountPasswordSchema,
  fullName: accountNameSchema,
  studentNumber: z.string().trim().min(2).max(30),
  courseId: idSchema,
  yearOfStudy: z.number().int().min(1).max(10).optional(),
  phone: phoneSchema.optional(),
});

export const updateStudentProfileSchema = z
  .object({
    courseId: idSchema.optional(),
    yearOfStudy: z.number().int().min(1).max(10).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    status: studentProfileStatusEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Pelo menos um campo deve ser fornecido' });

export const updateOwnStudentContactSchema = z.object({ phone: phoneSchema });

export const listStudentsQuerySchema = z.object({
  courseId: idSchema.optional(),
  status: studentProfileStatusEnum.optional(),
});

export type CreateStudentProfileInput = z.infer<typeof createStudentProfileSchema>;
export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;
export type UpdateOwnStudentContactInput = z.infer<typeof updateOwnStudentContactSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

export const teacherProfileStatusEnum = z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE']);

export const createTeacherProfileSchema = z.object({
  email: accountEmailSchema,
  password: accountPasswordSchema,
  fullName: accountNameSchema,
  employeeCode: z.string().trim().min(2).max(30),
  departmentId: idSchema,
  title: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional(),
});

export const updateTeacherProfileSchema = z
  .object({
    departmentId: idSchema.optional(),
    title: z.string().trim().min(2).max(80).optional(),
    phone: phoneSchema.nullable().optional(),
    status: teacherProfileStatusEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Pelo menos um campo deve ser fornecido' });

export const updateOwnTeacherContactSchema = z.object({ phone: phoneSchema });

export const listTeachersQuerySchema = z.object({
  departmentId: idSchema.optional(),
  status: teacherProfileStatusEnum.optional(),
});

export type CreateTeacherProfileInput = z.infer<typeof createTeacherProfileSchema>;
export type UpdateTeacherProfileInput = z.infer<typeof updateTeacherProfileSchema>;
export type UpdateOwnTeacherContactInput = z.infer<typeof updateOwnTeacherContactSchema>;
export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;

export const enrolmentStatusEnum = z.enum(['PENDING', 'ACTIVE', 'CANCELLED', 'COMPLETED']);

export const createEnrolmentSchema = z.object({
  studentId: idSchema,
  subjectId: idSchema,
  academicYear: z.number().int().min(2000).max(2100),
});

export const updateEnrolmentStatusSchema = z.object({ status: enrolmentStatusEnum });

export const listEnrolmentsQuerySchema = z.object({
  studentId: idSchema.optional(),
  subjectId: idSchema.optional(),
  academicYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type CreateEnrolmentInput = z.infer<typeof createEnrolmentSchema>;
export type UpdateEnrolmentStatusInput = z.infer<typeof updateEnrolmentStatusSchema>;
export type ListEnrolmentsQuery = z.infer<typeof listEnrolmentsQuerySchema>;

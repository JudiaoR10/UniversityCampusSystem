export type RoleCode =
  | "STUDENT"
  | "TEACHER"
  | "TECHNICIAN"
  | "COORDINATOR"
  | "ADMIN"
  | "FINANCE";

export type ModuleStatus = "available" | "partial" | "development";

export type CampusModule = {
  key: string;
  label: string;
  path: string;
  description: string;
  status: ModuleStatus;
  requiredRoles?: RoleCode[];
  groupHint?: string;
};

export type ApiSuccess<T> = {
  data: T;
  meta: {
    correlationId: string;
    page?: number;
    pageSize?: number;
    total?: number;
    offset?: number;
    limit?: number;
    hasMore?: boolean;
  };
};

export type ApiError = {
  code: string;
  message: string;
  details: unknown[];
  correlationId: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  isActive: boolean;
};

export type LoginResponse = {
  user: AuthUser;
  tokens: AuthTokens;
};

export type RoomDto = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  floor: number;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
  building: { id: string; code: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type BuildingDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  floors: number;
  roomsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LaboratoryDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  buildingId: string;
  building: { id: string; code: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type EquipmentDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  roomId: string | null;
  laboratoryId: string | null;
  room: { id: string; code: string; name: string } | null;
  laboratory: { id: string; code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentDto = {
  id: string;
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  roomId: string | null;
  reporterId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentType = 'TEST' | 'EXAM' | 'ASSIGNMENT' | 'PRACTICAL' | 'ORAL' | 'OTHER' | 'RECURRENCE';
export type GradingMode = 'PERCENTAGE' | 'POINTS' | 'SCALE';
export type SituacaoAcademica = 'EXCLUIDO' | 'APROVADO' | 'DISPENSADO' | 'ADMITIDO_AO_EXAME';

export type AcademicState =
  | 'PENDENTE'
  | 'DISPENSADO'
  | 'EXCLUIDO'
  | 'ADMITIDO_AO_EXAME'
  | 'APROVADO_EXAME'
  | 'REPROVADO_EXAME'
  | 'ADMITIDO_RECORRENCIA'
  | 'APROVADO_RECORRENCIA'
  | 'REPROVADO_RECORRENCIA'
  | 'NAO_ELEGIVEL_RECORRENCIA'
  | 'RECORRENCIA_EM_REVISAO';

export type ExamSlot = {
  assessmentId: string | null;
  grade: number | null;
  valuePercent: number | null;
  comment: string | null;
  editable: boolean;
  blockedReason: string | null;
};

export type RecurrenceSlot = ExamSlot & {
  asterisk: boolean;
  editable: boolean;
  blockedReason: string | null;
};

export type AssessmentDto = {
  id: string;
  title: string;
  description: string | null;
  type: AssessmentType;
  gradingMode: GradingMode;
  maxScore: number;
  weight: number;
  date: string | null;
  subjectId: string;
  subject?: { id: string; code: string; name: string };
  createdById: string;
  createdAt: string;
  updatedAt: string;
  hasGrades?: boolean;
  gradesCount?: number;
};

export type GradeDto = {
  id: string;
  assessmentId: string;
  studentId: string;
  value: number;
  valuePercent: number;
  comment: string | null;
  gradedById: string;
  assessment?: {
    id: string;
    title: string;
    type: AssessmentType;
    gradingMode: GradingMode;
    maxScore: number;
    weight: number;
    subjectId: string;
  };
  student?: { id: string; studentNumber: string; fullName?: string };
  createdAt: string;
  updatedAt: string;
};

export type FinalGradeDto = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  requiredTestCount: number | null;
  exempted?: boolean;
  exemptionGrade?: number | null;
  finalGrade: number | null;
  admissionGrade: number | null;
  examGrade: number | null;
  recurrenceGrade: number | null;
  usedExam: boolean;
  status: SituacaoAcademica | null;
  state: AcademicState | null;
  stateReason: string | null;
  recurrenceEligible: boolean;
  complete: boolean;
  totalWeight: number;
  gradedAssessments: number;
  assessments: number;
  breakdown: Array<{
    assessmentId: string;
    title: string;
    weight: number;
    value: number;
    valuePercent: number;
  }>;
};

export type ResultDto = {
  id: string;
  assessmentId: string;
  assessment?: {
    id: string;
    title: string;
    type: AssessmentType;
    gradingMode: GradingMode;
    maxScore: number;
    weight: number;
    subjectId: string;
    subject?: { id: string; code: string; name: string };
  };
  studentProfileId: string;
  studentUserId?: string;
  studentNumber?: string;
  value: number;
  valuePercent: number;
  comment: string | null;
  gradedById: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleDto = {
  id: string;
  title: string;
  subjectId: string;
  subject?: { id: string; code: string; name: string };
  courseId: string;
  course?: { id: string; code: string; name: string };
  teacherId: string | null;
  teacher: { id: string; fullName: string } | null;
  roomId: string | null;
  room: { id: string; code: string; name: string } | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleFiltersInput = {
  studentId?: string;
  courseId?: string;
  subjectId?: string;
  teacherId?: string;
  roomId?: string;
  from?: string;
  to?: string;
};

export type ScheduleOptions = {
  courses: Array<{ id: string; code: string; name: string }>;
  subjects: Array<{ id: string; code: string; name: string; courseId: string }>;
  teachers: Array<{ id: string; fullName: string }>;
  rooms: Array<{ id: string; code: string; name: string }>;
};

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';

export type AttendanceDto = {
  id: string;
  classScheduleId: string;
  classSchedule?: { id: string; title: string; startsAt: string; endsAt: string };
  studentProfileId: string;
  student?: { id: string; studentNumber: string; fullName?: string };
  status: AttendanceStatus;
  note: string | null;
  recordedById: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceSummaryDto = {
  studentProfileId: string;
  studentNumber: string;
  fullName?: string;
  present: number;
  absent: number;
  late: number;
  justified: number;
  total: number;
  attendanceRate: number;
};

export type AttendanceRosterEntry = {
  id: string;
  studentNumber: string;
  fullName?: string;
  attendanceId: string | null;
  status: AttendanceStatus | null;
  note: string | null;
};

export type AttendanceRoster = {
  schedule: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    subject?: { id: string; code: string; name: string };
    course?: { id: string; code: string; name: string };
  };
  entries: AttendanceRosterEntry[];
};

export type AssessmentRosterEntry = {
  studentProfileId: string;
  studentNumber: string;
  fullName?: string;
  value: number | null;
  valuePercent: number | null;
  comment: string | null;
  situacao: SituacaoAcademica | null;
  state?: AcademicState | null;
};

export type AssessmentRoster = {
  assessment: AssessmentDto;
  entries: AssessmentRosterEntry[];
};

export type AssessmentSubjectRules = {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  requiredTestCount: number | null;
  recurrenceMinAdmission: number | null;
  rulesConfigured: boolean;
  published: boolean;
  publishedAt: string | null;
  hasExamEpoch: boolean;
  hasRecurrenceEpoch: boolean;
};

export type SubjectBoardEntry = {
  studentProfileId: string;
  studentNumber: string;
  fullName: string | null;
  /** true quando o docente dispensou este estudante na disciplina. */
  exempted?: boolean;
  /** Nota de dispensa escolhida pelo docente (null = usa a admissão). */
  exemptionGrade?: number | null;
  /** Notas das avaliações contínuas lançadas. */
  continuous: Array<{ assessmentId: string; title: string; weight: number; value: number | null }>;
  /** Média de frequência/admissão (0–20), null enquanto incompleta. */
  admissionGrade: number | null;
  admissionPercent: number | null;
  complete: boolean;
  state: AcademicState | null;
  stateReason: string | null;
  /** Resumo legado (compatibilidade): APROVADO/EXCLUIDO/DISPENSADO/ADMITIDO_AO_EXAME. */
  status: SituacaoAcademica | null;
  exam: ExamSlot;
  recurrence: RecurrenceSlot;
  finalGrade: number | null;
  finalPercent: number | null;
};

export type SubjectBoardCounters = {
  total: number;
  pendentes: number;
  dispensados: number;
  excluidos: number;
  admitidosExame: number;
  aprovadosExame: number;
  reprovadosExame: number;
  admitidosRecorrencia: number;
  elegiveisRecorrencia: number;
  aprovadosRecorrencia: number;
  reprovadosRecorrencia: number;
  naoElegiveis: number;
  emRevisao: number;
};

export type SubjectBoard = {
  rules: AssessmentSubjectRules;
  /** Avaliação de exame normal (para lançamento de notas), null se não criada. */
  examAssessment: { id: string; title: string; gradingMode: GradingMode; maxScore: number } | null;
  /** Avaliação de recorrência (para lançamento de notas), null se não criada. */
  recurrenceAssessment: { id: string; title: string; gradingMode: GradingMode; maxScore: number } | null;
  counters: SubjectBoardCounters;
  entries: SubjectBoardEntry[];
};

export type AssessmentOptions = {
  subjects: Array<{
    id: string;
    code: string;
    name: string;
    courseId: string;
    requiredTestCount: number | null;
    recurrenceMinAdmission?: number | null;
    resultsPublishedAt?: string | null;
  }>;
};

export type DashboardSummary = {
  currentUser: AuthUser;
  coreStatus: "healthy" | "degraded";
  roomsCount: number;
  openIncidents: number;
  devicesCount: number;
  recentAlerts: Array<{
    id: string;
    title: string;
    severity: string;
    createdAt: string;
    isDemo: boolean;
  }>;
  modulesAvailable: number;
  modulesInDevelopment: number;
  recentActivity: Array<{
    id: string;
    action: string;
    resource: string;
    createdAt: string;
  }>;
};

export type ParkingSpotStatus =
  | "FREE"
  | "OCCUPIED"
  | "RESERVED"
  | "OUT_OF_SERVICE";

export type ParkingSpotDto = {
  id: string;
  code: string;
  rowLabel: string;
  level: number;
  status: ParkingSpotStatus;
  plate: string | null;
  updatedAt: string;
};

export type ParkingLotOverview = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  capacity: number;
  free: number;
  occupied: number;
  reserved: number;
  outOfService: number;
  occupancyPercent: number;
  readingsCount: number;
  spots: ParkingSpotDto[];
};

export type PlateReadingDto = {
  id: string;
  plate: string;
  direction: "IN" | "OUT";
  confidence: number;
  photoUrl: string | null;
  sensorCode: string;
  isDemo: boolean;
  lot: { id: string; code: string; name: string };
  spot: { id: string; code: string } | null;
  recordedAt: string;
};

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type SensorDto = {
  id: string;
  code: string;
  name: string;
  metric: string;
  unit: string | null;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
};

export type DeviceDto = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: DeviceStatus;
  roomId: string | null;
  mqttTopic: string | null;
  createdAt: string;
  updatedAt: string;
  sensors: SensorDto[];
  room: { id: string; code: string; name: string } | null;
};

export type AlertDto = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  sensorId: string | null;
  deviceId: string | null;
  acknowledged: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationDto = {
  id: string;
  userId: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export const campusModules: CampusModule[] = [
  {
    key: "ops",
    label: "Operações",
    path: "/ops",
    description:
      "Centro de operações com mapa, métricas ambientais e padrões do campus.",
    status: "available",
  },
  {
    key: "financial",
    label: "Gestão financeira",
    path: "/financial",
    description: "Dívidas, contestações, salários e relatórios de pagamentos.",
    status: "available",
    groupHint: "Grupo Financeiro",
    requiredRoles: ["STUDENT", "FINANCE", "ADMIN"],
  },
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    description: "Visão geral do campus e indicadores operacionais.",
    status: "available",
  },
  {
    key: "users",
    label: "Utilizadores e perfis",
    path: "/users",
    description: "Gestão de utilizadores, roles e perfis.",
    status: "available",
    requiredRoles: ["ADMIN", "COORDINATOR"],
  },
  {
    key: "academic",
    label: "Gestão académica",
    path: "/academic",
    description: "Hub académico: departamentos, cursos e planos.",
    status: "partial",
    groupHint: "Grupo Académico",
  },
  {
    key: "departments",
    label: "Departamentos",
    path: "/departments",
    description: "Estrutura departamental da universidade.",
    status: "development",
    groupHint: "Grupo Académico",
  },
  {
    key: "courses",
    label: "Cursos",
    path: "/courses",
    description: "Catálogo de cursos e programas.",
    status: "development",
    groupHint: "Grupo Académico",
  },
  {
    key: "subjects",
    label: "Disciplinas",
    path: "/subjects",
    description: "Disciplinas e planos curriculares.",
    status: "development",
    groupHint: "Grupo Académico",
  },
  {
    key: 'students',
    label: 'Estudantes',
    path: '/students',
    description: 'Dados académicos de estudantes.',
    status: 'available',
    requiredRoles: ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'],
    groupHint: 'Grupo Académico',
  },
  {
    key: 'teachers',
    label: 'Docentes',
    path: '/teachers',
    description: 'Perfil e afectação de docentes.',
    status: 'available',
    requiredRoles: ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'],
    groupHint: 'Grupo Académico',
  },
  {
    key: 'enrolments',
    label: 'Inscrições',
    path: '/enrolments',
    description: 'Inscrições de estudantes em disciplinas por ano lectivo.',
    status: 'available',
    requiredRoles: ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'],
    groupHint: 'Grupo Académico',
  },
  {
    key: 'assessments',
    label: 'Avaliações e notas',
    path: '/assessments',
    description: 'Avaliações, lançamento de notas e pauta final por disciplina.',
    status: 'available',
    groupHint: 'Grupo Académico',
    requiredRoles: ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'],
  },
  {
    key: 'schedules',
    label: 'Horários',
    path: '/schedules',
    description: 'Horários lectivos: consulta por curso/docente/sala e gestão pelo coordenador.',
    status: 'available',
    groupHint: 'Grupo Académico',
    requiredRoles: ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'],
  },
  {
    key: 'attendance',
    label: 'Assiduidade',
    path: '/attendance',
    description: 'Presenças, faltas e justificações por sessão de horário.',
    status: 'available',
    groupHint: 'Grupo Académico',
    requiredRoles: ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'],
  },
  {
    key: "campus",
    label: "Campus físico",
    path: "/campus",
    description: "Edifícios, salas e espaços do campus.",
    status: "partial",
    groupHint: "Grupo Infraestrutura",
  },
  {
    key: "buildings",
    label: "Edifícios",
    path: "/buildings",
    description: "Cadastro de edifícios.",
    status: "available",
    groupHint: "Grupo Infraestrutura",
  },
  {
    key: "rooms",
    label: "Salas",
    path: "/rooms",
    description: "Salas e disponibilidade.",
    status: "available",
    groupHint: "Grupo Infraestrutura",
  },
  {
    key: "laboratories",
    label: "Laboratórios",
    path: "/laboratories",
    description: "Laboratórios e espaços técnicos.",
    status: "available",
    groupHint: "Grupo Infraestrutura",
  },
  {
    key: "equipment",
    label: "Equipamentos",
    path: "/equipment",
    description: "Inventário de equipamentos.",
    status: "available",
    groupHint: "Grupo Infraestrutura",
  },
  {
    key: "incidents",
    label: "Ocorrências",
    path: "/incidents",
    description: "Pedidos e tratamento de ocorrências.",
    status: "available",
    groupHint: "Grupo Manutenção",
  },
  {
    key: "maintenance",
    label: "Manutenção",
    path: "/maintenance",
    description: "Acções de manutenção associadas a ocorrências.",
    status: "partial",
    groupHint: "Grupo Manutenção",
  },
  {
    key: "iot",
    label: "IoT",
    path: "/iot",
    description: "Dispositivos e leituras do campus inteligente.",
    status: "available",
    groupHint: "Grupo IoT",
  },
  {
    key: "parking",
    label: "Estacionamento",
    path: "/parking",
    description: "Parque de viaturas, vagas e leitura de matrículas.",
    status: "available",
    groupHint: "Grupo Infraestrutura / IoT",
  },
  {
    key: "devices",
    label: "Dispositivos",
    path: "/devices",
    description: "Registo de dispositivos IoT.",
    status: "available",
    groupHint: "Grupo IoT",
  },
  {
    key: "sensors",
    label: "Sensores",
    path: "/sensors",
    description: "Sensores associados a dispositivos.",
    status: "development",
    groupHint: "Grupo IoT",
  },
  {
    key: "readings",
    label: "Leituras",
    path: "/readings",
    description: "Leituras de sensores (MQTT futuro).",
    status: "development",
    groupHint: "Grupo IoT",
  },
  {
    key: "alerts",
    label: "Alertas",
    path: "/alerts",
    description: "Alertas operacionais e de sensores.",
    status: "available",
    groupHint: "Grupo IoT",
  },
  {
    key: "notifications",
    label: "Notificações",
    path: "/notifications",
    description: "Centro de notificações do utilizador.",
    status: "available",
    groupHint: "Grupo Core",
  },
  {
    key: "reports",
    label: "Relatórios",
    path: "/reports",
    description: "Indicadores e relatórios agregados.",
    status: "development",
    groupHint: "Grupo Relatórios",
  },
  {
    key: "audit",
    label: "Auditoria",
    path: "/audit",
    description: "Eventos de auditoria do sistema.",
    status: "available",
    requiredRoles: ["ADMIN", "COORDINATOR"],
  },
  {
    key: "admin",
    label: "Administração",
    path: "/admin",
    description: "Administração do sistema e configuração.",
    status: "partial",
    requiredRoles: ["ADMIN"],
  },
];

// Tipos do módulo academic (preservados do upstream — grupo académico)
export type Ref = { id: string; code: string; name: string };
export type DebtStatus = "PENDENTE" | "VENCIDA" | "REGULARIZADA" | "CANCELADA";
export type FinancialStatusType = "ACTIVE" | "BLOCKED";
export type AnalysisRequestStatus =
  | "PENDENTE_ANALISE"
  | "PROCEDENTE"
  | "IMPROCEDENTE";
export type PaymentMethod =
  | "BANK_TRANSFER"
  | "CASH_DEPOSIT"
  | "MOBILE_MONEY"
  | "POS";

// DTO de Divida
export interface DebtDto {
  id: string;
  code: string;
  studentId: string;
  title: string;
  description?: string;
  amount: number;
  origin: string;
  dueDate: string;
  status: DebtStatus;
  createdAt: string;
  updatedAt: string;
}

// DTO de Pagamento
export interface PaymentDto {
  id: string;
  code: string;
  debtId: string;
  studentId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  confirmedById: string;
  paidAt: string;
  createdAt: string;
}

// DTO de Estado Financeiro
export interface FinancialStatusDto {
  id: string;
  studentId: string;
  status: FinancialStatusType;
  blockedAt?: string;
  reason?: string;
  updatedAt: string;
}

// DTO de Pedido de Analise / Contestacao
export interface AnalysisRequestDto {
  id: string;
  code: string;
  debtId: string;
  studentId: string;
  reason: string;
  status: AnalysisRequestStatus;
  slaDueDate: string;
  resolvedById?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentIdentitySummaryDto {
  userId: string;
  fullName: string;
  studentNumber: string | null;
  isActive: boolean;
}

export interface FinancialAnalysisRequestViewDto extends AnalysisRequestDto {
  student: StudentIdentitySummaryDto;
  debt: { id: string; code: string; title: string; amount: number };
}

export interface FinancialReportDto {
  totalDebts: number;
  byStatus: { pendentes: number; vencidas: number; regularizadas: number; canceladas: number };
  totalPayments: number;
  studentsBlocked: number;
  generatedAt: string;
}

export interface TeacherIdentitySummaryDto {
  teacherId: string;
  userId: string;
  fullName: string;
  employeeCode: string;
  isActive: boolean;
}

export interface TeacherSalaryDto {
  id: string;
  teacher: TeacherIdentitySummaryDto;
  month: string;
  amount: number;
  notes: string;
  status: 'PENDING' | 'PAID';
  paymentMethod: PaymentMethod | null;
  referenceCode: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyPaymentRowDto {
  id: string;
  fullName: string;
  identityCode: string | null;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  paidAt: string;
}

export interface MonthlyPaymentReportDto {
  kind: 'payments' | 'salaries';
  month: string;
  timezone: 'Africa/Maputo';
  totalPayments: number;
  totalAmount: number;
  generatedAt: string;
  rows: MonthlyPaymentRowDto[];
}

// DTO de Notificacao Financeira
export interface FinancialNotificationDto {
  id: string;
  studentId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// DTO de Politica Financeira
export interface FinancialPolicyDto {
  id: string;
  code: string;
  gracePeriodDays: number;
  autoBlockEnabled: boolean;
  maxDebtAmount: number;
  updatedAt: string;
}

// DTO do Estado Financeiro Completo (resposta da rota /status)
export interface FinancialStatusSummaryDto {
  studentId: string;
  status: FinancialStatusType;
  reason: string | null;
  blockedAt: string | null;
  overdueDebtsCount: number;
  totalOverdueAmount: number;
  updatedAt: string;
}

// DTO do Historico Financeiro (resposta da rota /history)
export interface FinancialHistoryDto {
  pagination: {
    offset: number;
    limit: number;
    totalPayments: number;
    hasMoreDebts: boolean;
    hasMorePayments: boolean;
  };
  studentId: string;
  debts: DebtDto[];
  payments: PaymentDto[];
  status: FinancialStatusSummaryDto;
  totalDebts: number;
  totalPaid: number;
  totalOutstanding: number;
}

// Contrato proposto de envio para a API externa de Notificacoes.
export interface FinancialNotificationEvent {
  sourceModule: "financial";
  sourceEventId: string;
  recipientUserId: string;
  eventType: string;
  resourceId: string | null;
  title: string;
  message: string;
  channel: "IN_APP";
  occurredAt: string;
}

export interface FinancialNotificationDeliveryDto {
  id: string;
  deliveryStatus: "LOCAL_ONLY" | "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  externalNotificationId: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  lastError: string | null;
}

export type DepartmentDto = {
  id: string; code: string; name: string; description: string | null;
  createdAt: string; updatedAt: string;
};

export type CourseDto = {
  id: string; code: string; name: string; description: string | null;
  departmentId: string; department: Ref; createdAt: string; updatedAt: string;
};

export type SubjectDto = {
  id: string; code: string; name: string; credits: number;
  courseId: string; course: Ref; createdAt: string; updatedAt: string;
};

export type EntityRef = {
  id: string;
  code: string;
  name: string;
};

export type StudentProfileStatus = 'ACTIVE' | 'SUSPENDED' | 'GRADUATED' | 'WITHDRAWN';

export type StudentProfileDto = {
  id: string;
  userId: string;
  studentNumber: string;
  courseId: string | null;
  course: EntityRef | null;
  yearOfStudy: number | null;
  phone: string | null;
  status: StudentProfileStatus;
  user: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
};

export type CreateStudentProfilePayload = {
  email: string;
  password: string;
  fullName: string;
  studentNumber: string;
  courseId: string;
  yearOfStudy?: number;
  phone?: string;
};

export type UpdateStudentProfilePayload = {
  courseId?: string;
  yearOfStudy?: number | null;
  phone?: string | null;
  status?: StudentProfileStatus;
};

export type TeacherProfileStatus = 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';

export type TeacherProfileDto = {
  id: string;
  userId: string;
  employeeCode: string;
  departmentId: string | null;
  department: EntityRef | null;
  title: string | null;
  phone: string | null;
  status: TeacherProfileStatus;
  user: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
};

export type CreateTeacherProfilePayload = {
  email: string;
  password: string;
  fullName: string;
  employeeCode: string;
  departmentId: string;
  title?: string;
  phone?: string;
};

export type UpdateTeacherProfilePayload = {
  departmentId?: string;
  title?: string;
  phone?: string | null;
  status?: TeacherProfileStatus;
};

export type EnrolmentStatus = 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'COMPLETED';

export type SubjectEnrolmentDto = {
  id: string;
  studentId: string;
  student: { id: string; studentNumber: string; fullName: string };
  subjectId: string;
  subject: EntityRef;
  academicYear: number;
  status: EnrolmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateEnrolmentPayload = {
  studentId: string;
  subjectId: string;
  academicYear: number;
};
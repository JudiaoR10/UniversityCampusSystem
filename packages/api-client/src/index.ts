import type { DebtDto, DebtOrigin, DebtStatus, PaymentDto, AnalysisRequestDto, AnalysisRequestStatus, StudentIdentitySummaryDto, FinancialAnalysisRequestViewDto, FinancialReportDto, FinancialStatusSummaryDto, FinancialHistoryDto, FinancialNotificationDto, FinancialNotificationDeliveryDto, FinancialNotificationQueueItemDto, FinancialPolicyDto, BlockedStudentDto, PaymentReceiptDto, SalaryReceiptDto, DebtsFromEnrolmentsResultDto } from '@smart-campus/shared-types';
import type {
  TeacherIdentitySummaryDto,
  EmployeeDto,
  EmployeeSalaryDto,
  SalaryChangeRequestDto,
  CourseTuitionDto,
  MonthlyPaymentReportDto,
  AdminSettingsDto,
  AdminStatusDto,
  AlertDto,
  ApiError,
  ApiSuccess,
  AssessmentDto,
  AssessmentOptions,
  AssessmentRoster,
  AttendanceDto,
  AttendanceRoster,
  AttendanceSummaryDto,
  AuthUser,
  BuildingDto,
  CourseDto,
  CreateEnrolmentPayload,
  CreateStudentProfilePayload,
  CreateTeacherProfilePayload,
  DashboardSummary,
  DepartmentDto,
  DeviceDto,
  EnrolmentStatus,
  EquipmentDto,
  FinalGradeDto,
  GradeDto,
  IncidentDto,
  LaboratoryDto,
  LoginResponse,
  MaintenanceActionDto,
  NotificationDto,
  OpsSnapshot,
  ParkingLotOverview,
  PlateReadingDto,
  ReadingDto,
  ReportSummaryDto,
  ResultDto,
  RoomDto,
  ScheduleDto,
  SensorDto,
  ScheduleFiltersInput,
  ScheduleOptions,
  SubjectBoard,
  StudentProfileDto,
  StudentProfileStatus,
  SubjectDto,
  SubjectEnrolmentDto,
  TeacherProfileDto,
  TeacherProfileStatus,
  UpdateStudentProfilePayload,
  UpdateTeacherProfilePayload,
} from '@smart-campus/shared-types';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly correlationId: string,
    public readonly details: unknown[] = [],
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type TokenStore = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clear: () => void;
};

function toQuery(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

type QueryParams = Record<string, string | number | undefined>;

function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function createApiClient(baseUrl: string, tokenStore: TokenStore) {
  const queryString = (params: Record<string, string | number | boolean | undefined>) =>
    new URLSearchParams(Object.entries(params).filter(entry => entry[1] !== undefined).map(([key, value]): [string, string] => [key, String(value)])).toString();
  async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<ApiSuccess<T>> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    const access = tokenStore.getAccessToken();
    if (access) headers.set('Authorization', `Bearer ${access}`);

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const body = await res.json().catch(() => ({}));

    if (res.status === 401 && retry && tokenStore.getRefreshToken()) {
      const refreshed = await refresh();
      if (refreshed) return request<T>(path, init, false);
    }

    if (!res.ok) {
      const err = body as ApiError;
      throw new ApiClientError(err.code ?? 'UNKNOWN', err.message ?? 'Erro desconhecido', err.correlationId ?? '', err.details ?? [], res.status);
    }

    return body as ApiSuccess<T>;
  }

  async function refresh(): Promise<boolean> {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    const json = (await res.json()) as ApiSuccess<{ accessToken: string; refreshToken: string }>;
    tokenStore.setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  }

  return {
    login: (email: string, password: string) =>
      request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: tokenStore.getRefreshToken() }) }),
    me: () => request<AuthUser>('/me'),
    users: () => request<AuthUser[]>('/users'),
    createUser: (payload: unknown) =>
      request<AuthUser>('/users', { method: 'POST', body: JSON.stringify(payload) }),
    updateUser: (id: string, payload: unknown) =>
      request<AuthUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    rooms: () => request<RoomDto[]>('/rooms'),
    room: (id: string) => request<RoomDto>(`/rooms/${id}`),
    createRoom: (payload: unknown) => request<RoomDto>('/rooms', { method: 'POST', body: JSON.stringify(payload) }),
    updateRoom: (id: string, payload: unknown) =>
      request<RoomDto>(`/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteRoom: (id: string) => request<{ id: string }>(`/rooms/${id}`, { method: 'DELETE' }),
    buildings: () => request<BuildingDto[]>('/buildings'),
    building: (id: string) => request<BuildingDto>(`/buildings/${id}`),
    createBuilding: (payload: unknown) => request<BuildingDto>('/buildings', { method: 'POST', body: JSON.stringify(payload) }),
    updateBuilding: (id: string, payload: unknown) =>
      request<BuildingDto>(`/buildings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteBuilding: (id: string) => request<{ id: string }>(`/buildings/${id}`, { method: 'DELETE' }),
    laboratories: () => request<LaboratoryDto[]>('/laboratories'),
    laboratory: (id: string) => request<LaboratoryDto>(`/laboratories/${id}`),
    createLaboratory: (payload: unknown) =>
      request<LaboratoryDto>('/laboratories', { method: 'POST', body: JSON.stringify(payload) }),
    updateLaboratory: (id: string, payload: unknown) =>
      request<LaboratoryDto>(`/laboratories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteLaboratory: (id: string) => request<{ id: string }>(`/laboratories/${id}`, { method: 'DELETE' }),
    equipment: () => request<EquipmentDto[]>('/equipment'),
    equipmentItem: (id: string) => request<EquipmentDto>(`/equipment/${id}`),
    createEquipment: (payload: unknown) => request<EquipmentDto>('/equipment', { method: 'POST', body: JSON.stringify(payload) }),
    updateEquipment: (id: string, payload: unknown) =>
      request<EquipmentDto>(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteEquipment: (id: string) => request<{ id: string }>(`/equipment/${id}`, { method: 'DELETE' }),
    incidents: () => request<IncidentDto[]>('/incidents'),
    createIncident: (payload: unknown) => request<IncidentDto>('/incidents', { method: 'POST', body: JSON.stringify(payload) }),
    updateIncidentStatus: (id: string, payload: unknown) =>
      request<IncidentDto>(`/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),
    devices: () => request<DeviceDto[]>('/devices'),
    createDevice: (payload: unknown) =>
      request<DeviceDto>('/devices', { method: 'POST', body: JSON.stringify(payload) }),
    updateDevice: (id: string, payload: unknown) =>
      request<DeviceDto>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    alerts: (deviceId?: string) =>
      request<AlertDto[]>(deviceId ? `/alerts?deviceId=${encodeURIComponent(deviceId)}` : '/alerts'),
    updateDeviceStatus: (id: string, payload: unknown) =>
      request<DeviceDto>(`/devices/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }), 
    deleteDevice: (id: string) =>
  request<{ id: string }>(`/devices/${id}`, { method: 'DELETE' }),
    ackAlert: (id: string) =>
      request<AlertDto>(`/alerts/${id}/ack`, { method: 'PATCH', body: JSON.stringify({}) }),
    notifications: () => request<NotificationDto[]>('/notifications'),
    markNotificationRead: (id: string) =>
      request<NotificationDto>(`/notifications/${id}/read`, { method: 'PATCH', body: JSON.stringify({}) }),
    auditEvents: () => request<unknown[]>('/audit-events'),
    dashboard: () => request<DashboardSummary>('/dashboard'),
    opsSnapshot: () => request<OpsSnapshot>('/ops/snapshot'),
    sensors: () => request<SensorDto[]>('/sensors'),
    createSensor: (payload: unknown) =>
      request<SensorDto>('/sensors', { method: 'POST', body: JSON.stringify(payload) }),
    updateSensor: (id: string, payload: unknown) =>
      request<SensorDto>(`/sensors/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteSensor: (id: string) => request<{ id: string }>(`/sensors/${id}`, { method: 'DELETE' }),
    sensorReadings: (id: string) => request<ReadingDto[]>(`/sensors/${id}/readings`),
    readings: (params?: { sensorId?: string; metric?: string; includeDemo?: boolean; limit?: number }) =>
      request<ReadingDto[]>(`/readings${buildQuery({
        sensorId: params?.sensorId,
        metric: params?.metric,
        includeDemo: params?.includeDemo === false ? 'false' : undefined,
        limit: params?.limit,
      })}`),
    maintenance: () => request<MaintenanceActionDto[]>('/maintenance'),
    createMaintenance: (payload: unknown) =>
      request<MaintenanceActionDto>('/maintenance', { method: 'POST', body: JSON.stringify(payload) }),
    updateMaintenance: (id: string, payload: unknown) =>
      request<MaintenanceActionDto>(`/maintenance/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    reportSummary: () => request<ReportSummaryDto>('/reports/summary'),
    adminSettings: () => request<AdminSettingsDto>('/admin/settings'),
    updateAdminSettings: (payload: unknown) =>
      request<AdminSettingsDto>('/admin/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
    adminStatus: () => request<AdminStatusDto>('/admin/status'),
    parkingOverview: () => request<ParkingLotOverview[]>('/parking/overview'),
    parkingReadings: () => request<PlateReadingDto[]>('/parking/readings'),
    createPlateReading: (payload: unknown) =>
      request<PlateReadingDto>('/parking/readings', { method: 'POST', body: JSON.stringify(payload) }),
    updateParkingSpot: (id: string, payload: unknown) =>
      request<unknown>(`/parking/spots/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    assessments: () => request<AssessmentDto[]>('/assessments'),
    assessmentOptions: () => request<AssessmentOptions>('/assessments/options'),
    assessmentRoster: (id: string) => request<AssessmentRoster>(`/assessments/${id}/roster`),
    assessmentGrades: (id: string) => request<GradeDto[]>(`/assessments/${id}/grades`),
    upsertGrades: (id: string, payload: unknown) =>
      request<GradeDto[]>(`/assessments/${id}/grades`, { method: 'POST', body: JSON.stringify(payload) }),
    createAssessment: (payload: unknown) =>
      request<AssessmentDto>('/assessments', { method: 'POST', body: JSON.stringify(payload) }),
    updateAssessment: (id: string, payload: unknown) =>
      request<AssessmentDto>(`/assessments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteAssessment: (id: string) => request<{ id: string }>(`/assessments/${id}`, { method: 'DELETE' }),
    setRequiredTestCount: (subjectId: string, requiredTestCount: number | null) =>
      request<{ id: string; code: string; name: string; requiredTestCount: number | null }>(
        `/assessments/subject/${subjectId}/required-test-count`,
        { method: 'PATCH', body: JSON.stringify({ requiredTestCount }) },
      ),
    subjectBoard: (subjectId: string) => request<SubjectBoard>(`/assessments/subject/${subjectId}/board`),
    setSubjectRules: (
      subjectId: string,
      payload: {
        requiredTestCount?: number | null;
        recurrenceMinAdmission?: number | null;
        exemptionMinGrade?: number | null;
      },
    ) =>
      request<{ id: string; code: string; name: string; requiredTestCount: number | null; recurrenceMinAdmission: number | null; exemptionMinGrade: number | null; resultsPublishedAt: string | Date | null }>(
        `/assessments/subject/${subjectId}/rules`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ),
    publishResults: (subjectId: string, published: boolean) =>
      request<{
        subjectId: string;
        subjectCode: string;
        subjectName: string;
        published: boolean;
        publishedAt: string | null;
      }>(`/assessments/subject/${subjectId}/publish`, { method: 'POST', body: JSON.stringify({ published }) }),
    setSubjectExemption: (
      subjectId: string,
      payload: { studentId: string; exempted: boolean; grade?: number | null; reason?: string | null },
    ) =>
      request<{ subjectId: string; studentId: string; exempted: boolean; grade: number | null }>(
        `/assessments/subject/${subjectId}/exemptions`,
        { method: 'POST', body: JSON.stringify(payload) },
      ),
    myGrades: () => request<GradeDto[]>('/my/grades'),
    myFinalGrades: () => request<FinalGradeDto[]>('/my/final-grades'),
    results: (params?: Record<string, string | undefined>) =>
      request<ResultDto[]>(`/results${toQuery(params)}`),
    createResult: (payload: unknown) =>
      request<ResultDto>('/results', { method: 'POST', body: JSON.stringify(payload) }),
    attendance: (filters: Record<string, string | undefined> = {}) =>
      request<AttendanceDto[]>(`/attendance${toQuery(filters)}`),
    attendanceSummary: (filters: Record<string, string | undefined> = {}) =>
      request<AttendanceSummaryDto[]>(`/attendance/summary${toQuery(filters)}`),
    attendanceSessions: () => request<ScheduleDto[]>('/attendance/sessions'),
    attendanceRoster: (scheduleId: string) =>
      request<AttendanceRoster>(`/attendance/sessions/${scheduleId}`),
    markAttendance: (scheduleId: string, payload: unknown) =>
      request<AttendanceRoster>(`/attendance/sessions/${scheduleId}`, { method: 'POST', body: JSON.stringify(payload) }),
    schedules: (filters: ScheduleFiltersInput = {}) =>
      request<ScheduleDto[]>(`/schedules${toQuery(filters as Record<string, string | undefined>)}`),
    scheduleOptions: () => request<ScheduleOptions>('/schedules/options'),
    createSchedule: (payload: unknown) =>
      request<ScheduleDto>('/schedules', { method: 'POST', body: JSON.stringify(payload) }),
    updateSchedule: (id: string, payload: unknown) =>
      request<ScheduleDto>(`/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteSchedule: (id: string) => request<{ id: string }>(`/schedules/${id}`, { method: 'DELETE' }),
    financialDebts: (params: { studentId?: string; status?: DebtStatus; origin?: DebtOrigin; dueBefore?: string; offset?: number; limit?: number } = {}) =>
      request<DebtDto[]>(`/financial/debts?${queryString(params)}`),
    financialDebt: (id: string) => request<DebtDto>(`/financial/debts/${encodeURIComponent(id)}`),
    createDebt: (payload: unknown) => request<DebtDto>('/financial/debts', { method: 'POST', body: JSON.stringify(payload) }),
    cancelDebt: (id: string) => request<DebtDto>(`/financial/debts/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: '{}' }),
    createDebtsFromEnrolments: (payload: unknown) => request<DebtsFromEnrolmentsResultDto>('/financial/debts/from-enrolments', { method: 'POST', body: JSON.stringify(payload) }),
    createPayment: (payload: unknown) => request<{ payment: PaymentDto; debtStatus: string; studentFinancialStatus: 'ACTIVE' | 'BLOCKED' }>('/financial/payments', { method: 'POST', body: JSON.stringify(payload) }),
    paymentReceipt: (id: string) => request<PaymentReceiptDto>(`/financial/payments/${encodeURIComponent(id)}/receipt`),
    salaryReceipt: (id: string) => request<SalaryReceiptDto>(`/financial/salaries/${encodeURIComponent(id)}/receipt`),
    financialStatus: (id: string) => request<FinancialStatusSummaryDto>(`/financial/students/${encodeURIComponent(id)}/status`),
    financialBlockedStudents: (params: { offset?: number; limit?: number } = {}) => request<BlockedStudentDto[]>(`/financial/students/blocked?${queryString(params)}`),
    financialNotificationQueue: (params: { deliveryStatus?: FinancialNotificationDeliveryDto['deliveryStatus']; offset?: number; limit?: number } = {}) =>
      request<FinancialNotificationQueueItemDto[]>(`/financial/notifications?${queryString(params)}`),
    retryFailedNotifications: () => request<{ retried: number; results: FinancialNotificationDeliveryDto[] }>('/financial/notifications/retry-failed', { method: 'POST', body: '{}' }),
    financialHistory: (id: string, params: { offset?: number; limit?: number } = {}) => request<FinancialHistoryDto>(`/financial/students/${encodeURIComponent(id)}/history?${queryString(params)}`),
    financialNotifications: (id: string, params: { offset?: number; limit?: number } = {}) => request<FinancialNotificationDto[]>(`/financial/students/${encodeURIComponent(id)}/notifications?${queryString(params)}`),
    financialStudents: (params: { q?: string; offset?: number; limit?: number } = {}) => request<StudentIdentitySummaryDto[]>(`/financial/students?${queryString(params)}`),
    financialAnalysisRequests: (params: { status?: AnalysisRequestStatus; studentId?: string; debtId?: string; offset?: number; limit?: number } = {}) => request<FinancialAnalysisRequestViewDto[]>(`/financial/analysis-requests?${queryString(params)}`),
    financialAnalysisRequest: (id: string) => request<FinancialAnalysisRequestViewDto>(`/financial/analysis-requests/${encodeURIComponent(id)}`),
    financialReport: () => request<FinancialReportDto>('/financial/reports'),
    financialTeachers: (params: { q?: string; offset?: number; limit?: number } = {}) => request<TeacherIdentitySummaryDto[]>(`/financial/teachers?${queryString(params)}`),
    financialEmployees: (params: { q?: string; category?: string; active?: boolean; offset?: number; limit?: number } = {}) =>
      request<EmployeeDto[]>(`/financial/employees?${queryString(params)}`),
    createExternalEmployee: (payload: unknown) =>
      request<EmployeeDto>('/financial/employees/external', { method: 'POST', body: JSON.stringify(payload) }),
    salaryChangeRequests: (params: { status?: string; offset?: number; limit?: number } = {}) =>
      request<SalaryChangeRequestDto[]>(`/financial/salary-change-requests?${queryString(params)}`),
    createSalaryChange: (payload: unknown) =>
      request<SalaryChangeRequestDto>('/financial/salary-change-requests', { method: 'POST', body: JSON.stringify(payload) }),
    reviewSalaryChange: (id: string, payload: unknown) =>
      request<SalaryChangeRequestDto>(`/financial/salary-change-requests/${encodeURIComponent(id)}/review`, { method: 'PATCH', body: JSON.stringify(payload) }),
    financialSalaries: (params: { month: string; offset?: number; limit?: number }) => request<EmployeeSalaryDto[]>(`/financial/salaries?${queryString(params)}`),
    createSalary: (payload: unknown) => request<EmployeeSalaryDto>('/financial/salaries', { method: 'POST', body: JSON.stringify(payload) }),
    paySalary: (id: string, payload: unknown) => request<EmployeeSalaryDto>(`/financial/salaries/${encodeURIComponent(id)}/payment`, { method: 'POST', body: JSON.stringify(payload) }),
    courseTuitions: () => request<CourseTuitionDto[]>('/financial/course-tuitions'),
    updateCourseTuition: (courseId: string, payload: unknown) =>
      request<CourseTuitionDto>(`/financial/course-tuitions/${encodeURIComponent(courseId)}`, { method: 'PUT', body: JSON.stringify(payload) }),
    monthlyPaymentReport: (kind: 'payments' | 'salaries', month: string) => request<MonthlyPaymentReportDto>(`/financial/reports/${kind}?${queryString({ month })}`),
    createAnalysisRequest: (payload: unknown) => request<AnalysisRequestDto>('/financial/analysis-requests', { method: 'POST', body: JSON.stringify(payload) }),
    resolveAnalysisRequest: (id: string, payload: unknown) => request<AnalysisRequestDto>(`/financial/analysis-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    financialPolicy: (id = 'DEFAULT_POLICY') => request<FinancialPolicyDto>(`/financial/policies/${encodeURIComponent(id)}`),
    updateFinancialPolicy: (payload: unknown, id = 'DEFAULT_POLICY') => request<FinancialPolicyDto>(`/financial/policies/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    financialDelivery: (id: string) => request<FinancialNotificationDeliveryDto>(`/financial/notifications/${encodeURIComponent(id)}/delivery`),
    retryFinancialDelivery: (id: string) => request<FinancialNotificationDeliveryDto>(`/financial/notifications/${encodeURIComponent(id)}/retry`, { method: 'POST', body: '{}' }),
    departments: () => request<DepartmentDto[]>('/departments'),
    createDepartment: (payload: unknown) =>
      request<DepartmentDto>('/departments', { method: 'POST', body: JSON.stringify(payload) }),
    deleteDepartment: (id: string) => request<{ ok: true }>(`/departments/${id}`, { method: 'DELETE' }),
    courses: (departmentId?: string) =>
      request<CourseDto[]>(`/courses${departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : ''}`),
    createCourse: (payload: unknown) =>
      request<CourseDto>('/courses', { method: 'POST', body: JSON.stringify(payload) }),
    updateCourse: (id: string, payload: unknown) =>
      request<CourseDto>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteCourse: (id: string) => request<{ ok: true }>(`/courses/${id}`, { method: 'DELETE' }),
    createCourseWithSubjects: (payload: unknown) =>
      request<{ course: CourseDto; subjects: SubjectDto[] }>('/courses/batch-with-subjects', { method: 'POST', body: JSON.stringify(payload) }),
    subjects: (courseId?: string) =>
      request<SubjectDto[]>(`/subjects${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`),
    createSubject: (payload: unknown) =>
      request<SubjectDto>('/subjects', { method: 'POST', body: JSON.stringify(payload) }),
    updateSubject: (id: string, payload: unknown) =>
      request<SubjectDto>(`/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteSubject: (id: string) => request<{ ok: true }>(`/subjects/${id}`, { method: 'DELETE' }),
    students: {
      list: (params?: { courseId?: string; status?: StudentProfileStatus }) =>
        request<StudentProfileDto[]>(`/students${buildQuery(params)}`),
      getMe: () => request<StudentProfileDto>('/students/me'),
      getById: (id: string) => request<StudentProfileDto>(`/students/${id}`),
      getByUser: (userId: string) => request<StudentProfileDto>(`/students/by-user/${userId}`),
      create: (payload: CreateStudentProfilePayload) =>
        request<StudentProfileDto>('/students', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id: string, payload: UpdateStudentProfilePayload) =>
        request<StudentProfileDto>(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      updateOwn: (payload: { phone: string }) =>
        request<StudentProfileDto>('/students/me', { method: 'PATCH', body: JSON.stringify(payload) }),
      remove: (id: string) =>
        request<{ id: string; deleted: true }>(`/students/${id}`, { method: 'DELETE' }),
    },
    teachers: {
      list: (params?: { departmentId?: string; status?: TeacherProfileStatus }) =>
        request<TeacherProfileDto[]>(`/teachers${buildQuery(params)}`),
      getMe: () => request<TeacherProfileDto>('/teachers/me'),
      getById: (id: string) => request<TeacherProfileDto>(`/teachers/${id}`),
      getByUser: (userId: string) => request<TeacherProfileDto>(`/teachers/by-user/${userId}`),
      create: (payload: CreateTeacherProfilePayload) =>
        request<TeacherProfileDto>('/teachers', { method: 'POST', body: JSON.stringify(payload) }),
      update: (id: string, payload: UpdateTeacherProfilePayload) =>
        request<TeacherProfileDto>(`/teachers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      updateOwn: (payload: { phone: string }) =>
        request<TeacherProfileDto>('/teachers/me', { method: 'PATCH', body: JSON.stringify(payload) }),
      remove: (id: string) =>
        request<{ id: string; deleted: true }>(`/teachers/${id}`, { method: 'DELETE' }),
    },
    enrolments: {
      list: (params?: { studentId?: string; subjectId?: string; academicYear?: number }) =>
        request<SubjectEnrolmentDto[]>(`/enrolments${buildQuery(params)}`),
      create: (payload: CreateEnrolmentPayload) =>
        request<SubjectEnrolmentDto>('/enrolments', { method: 'POST', body: JSON.stringify(payload) }),
      updateStatus: (id: string, status: EnrolmentStatus) =>
        request<SubjectEnrolmentDto>(`/enrolments/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),
      remove: (id: string) =>
        request<{ id: string; deleted: true }>(`/enrolments/${id}`, { method: 'DELETE' }),
    },
    health: async () => {
      const res = await fetch(`${baseUrl.replace(/\/api\/v1$/, '')}/health`);
      return res.json();
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
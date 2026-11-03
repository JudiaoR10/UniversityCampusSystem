import type { DebtDto, PaymentDto, AnalysisRequestDto, AnalysisRequestStatus, StudentIdentitySummaryDto, FinancialAnalysisRequestViewDto, FinancialReportDto, FinancialStatusSummaryDto, FinancialHistoryDto, FinancialNotificationDto, FinancialNotificationDeliveryDto, FinancialPolicyDto } from '@smart-campus/shared-types';
import type {
  TeacherIdentitySummaryDto,
  EmployeeDto,
  EmployeeSalaryDto,
  SalaryChangeRequestDto,
  CourseTuitionDto,
  MonthlyPaymentReportDto,
  AlertDto,
  ApiError,
  ApiSuccess,
  AuthUser,
  BuildingDto,
  CourseDto,
  DashboardSummary,
  DepartmentDto,
  DeviceDto,
  EquipmentDto,
  IncidentDto,
  LaboratoryDto,
  LoginResponse,
  NotificationDto,
  ParkingLotOverview,
  PlateReadingDto,
  RoomDto,
  SubjectDto,
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
    parkingOverview: () => request<ParkingLotOverview[]>('/parking/overview'),
    parkingReadings: () => request<PlateReadingDto[]>('/parking/readings'),
    createPlateReading: (payload: unknown) =>
      request<PlateReadingDto>('/parking/readings', { method: 'POST', body: JSON.stringify(payload) }),
    updateParkingSpot: (id: string, payload: unknown) =>
      request<unknown>(`/parking/spots/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    financialDebts: (params: { studentId?: string; offset?: number; limit?: number } = {}) => {
      const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)] as [string, string]));
      return request<DebtDto[]>(`/financial/debts?${query}`);
    },
    financialDebt: (id: string) => request<DebtDto>(`/financial/debts/${encodeURIComponent(id)}`),
    createDebt: (payload: unknown) => request<DebtDto>('/financial/debts', { method: 'POST', body: JSON.stringify(payload) }),
    createPayment: (payload: unknown) => request<{ payment: PaymentDto; debtStatus: string; studentFinancialStatus: 'ACTIVE' | 'BLOCKED' }>('/financial/payments', { method: 'POST', body: JSON.stringify(payload) }),
    financialStatus: (id: string) => request<FinancialStatusSummaryDto>(`/financial/students/${encodeURIComponent(id)}/status`),
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
    createCourseWithSubjects: (payload: unknown) =>
      request<{ course: CourseDto; subjects: SubjectDto[] }>('/courses/batch-with-subjects', { method: 'POST', body: JSON.stringify(payload) }),
    subjects: (courseId?: string) =>
      request<SubjectDto[]>(`/subjects${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`),
    createSubject: (payload: unknown) =>
      request<SubjectDto>('/subjects', { method: 'POST', body: JSON.stringify(payload) }),
    health: async () => {
      const res = await fetch(`${baseUrl.replace(/\/api\/v1$/, '')}/health`);
      return res.json();
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

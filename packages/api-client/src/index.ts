import type {
  ApiError,
  ApiSuccess,
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
  IncidentDto,
  LaboratoryDto,
  LoginResponse,
  NotificationDto,
  ParkingLotOverview,
  PlateReadingDto,
  RoomDto,
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
      throw new ApiClientError(
        err.code ?? 'UNKNOWN',
        err.message ?? 'Erro desconhecido',
        err.correlationId ?? '',
        err.details ?? [],
        res.status,
      );
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
    logout: () =>
      request<{ ok: true }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokenStore.getRefreshToken() }),
      }),
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
      request<import('@smart-campus/shared-types').AlertDto[]>(deviceId ? `/alerts?deviceId=${encodeURIComponent(deviceId)}` : '/alerts'),
    updateDeviceStatus: (id: string, payload: unknown) =>
      request<DeviceDto>(`/devices/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteDevice: (id: string) =>
      request<{ id: string }>(`/devices/${id}`, { method: 'DELETE' }),
    ackAlert: (id: string) =>
      request<import('@smart-campus/shared-types').AlertDto>(`/alerts/${id}/ack`, { method: 'PATCH', body: JSON.stringify({}) }),
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
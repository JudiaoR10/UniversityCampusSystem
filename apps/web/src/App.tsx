import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { CampusOpsPage } from './pages/CampusOpsPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { RoomsPage } from './pages/RoomsPage';
import { LaboratoriesPage } from './pages/LaboratoriesPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { BuildingsPage } from './pages/BuildingsPage';
import { DevicesPage } from './pages/DevicesPage';
import { IotHubPage } from './pages/IotHubPage';
import { ParkingPage } from './pages/ParkingPage';
import { AlertsPage } from './pages/AlertsPage';
import { AuditPage } from './pages/AuditPage';
import { AdminPage } from './pages/AdminPage';
import { AcademicHubPage } from './pages/AcademicHubPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { CoursesPage } from './pages/CoursesPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { AssessmentsPage } from './pages/AssessmentsPage';
import { AttendancePage } from './pages/AttendancePage';
import { CampusHubPage } from './pages/CampusHubPage';
import { StudentsPage } from './pages/StudentsPage';
import { TeachersPage } from './pages/TeachersPage';
import { EnrolmentsPage } from './pages/EnrolmentsPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { campusModules, type RoleCode } from '@smart-campus/shared-types';
import { NotificationsPage } from './pages/NotificationsPage';
import { FinancialPage } from './pages/FinancialPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-campus-deep">
        A carregar sessão...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleProtected({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: RoleCode[];
}) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/ops" replace />;
  }

  return children;
}

const placeholderKeys = campusModules
  .filter((m) =>
    [
      //'departments',
      //'courses',
      //'subjects',
      'students',
      'teachers',
      'enrolments',
      //'assessments',
      //'schedules',
      'maintenance',
      'sensors',
      'readings',
      'reports',
    ].includes(m.key),
  )
  .map((m) => m.key);

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >

        <Route index element={<Navigate to="/ops" replace />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="ops" element={<CampusOpsPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="financial"
          element={
            <RoleProtected allowedRoles={['STUDENT', 'FINANCE', 'ADMIN']}>
              <FinancialPage />
            </RoleProtected>
          }
        />
        <Route path="users" element={<UsersPage />} />
        <Route path="academic" element={<AcademicHubPage />} />
        <Route path="campus" element={<CampusHubPage />} />
        <Route path="buildings" element={<BuildingsPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="laboratories" element={<LaboratoriesPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="assessments" element={<AssessmentsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="iot" element={<IotHubPage />} />
        <Route path="parking" element={<ParkingPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="teachers" element={<TeachersPage />} />
        <Route path="enrolments" element={<EnrolmentsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="admin" element={<AdminPage />} />
        {placeholderKeys.map((key) => {
          const mod = campusModules.find((m) => m.key === key)!;
          return (
            <Route
              key={key}
              path={mod.path.slice(1)}
              element={<ModulePlaceholderPage moduleKey={key} />}
            />
          );
        })}
      </Route>
      <Route path="*" element={<Navigate to="/ops" replace />} />
    </Routes>
  );
}

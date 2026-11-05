export const ALERT_VIEW_ROLES = ['ADMIN', 'COORDINATOR', 'TECHNICIAN'];

export function canViewAlerts(role?: string) {
  return !!role && ALERT_VIEW_ROLES.includes(role);
}

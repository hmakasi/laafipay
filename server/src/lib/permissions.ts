// Porté de src/lib/permissions.ts (frontend) — même source de vérité, appliquée ici côté serveur.
// Toute modification doit être répercutée des deux côtés jusqu'à ce qu'un package partagé existe.

export type UserRole = 'admin' | 'hr_manager' | 'manager' | 'accountant' | 'employee';

export type Permission =
  | 'employees:read'
  | 'employees:write'
  | 'employees:delete'
  | 'payroll:read'
  | 'payroll:write'
  | 'payroll:approve'
  | 'payroll:settings'
  | 'payments:read'
  | 'payments:initiate'
  | 'payments:validate'
  | 'payslips:read'
  | 'payslips:generate'
  | 'payslips:send'
  | 'leaves:read'
  | 'leaves:write'
  | 'leaves:approve'
  | 'leaves:read_team'
  | 'reviews:read'
  | 'reviews:write'
  | 'reviews:manage_team'
  | 'reports:read'
  | 'reports:export'
  | 'users:read'
  | 'users:write'
  | 'settings:read'
  | 'settings:write'
  | 'audit:read'
  | 'compta:access'
  | 'self:payslips'
  | 'self:leaves'
  | 'self:profile'
  | 'self:reviews';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'employees:read', 'employees:write', 'employees:delete',
    'payroll:read', 'payroll:write', 'payroll:approve', 'payroll:settings',
    'payments:read', 'payments:initiate', 'payments:validate',
    'payslips:read', 'payslips:generate', 'payslips:send',
    'leaves:read', 'leaves:write', 'leaves:approve', 'leaves:read_team',
    'reviews:read', 'reviews:write', 'reviews:manage_team',
    'reports:read', 'reports:export',
    'users:read', 'users:write', 'settings:read', 'settings:write', 'audit:read',
    'compta:access',
    'self:payslips', 'self:leaves', 'self:profile', 'self:reviews',
  ],
  hr_manager: [
    'employees:read', 'employees:write',
    'payroll:read', 'payroll:write', 'payroll:approve',
    'payments:read', 'payments:initiate',
    'payslips:read', 'payslips:generate', 'payslips:send',
    'leaves:read', 'leaves:write', 'leaves:approve', 'leaves:read_team',
    'reviews:read', 'reviews:write', 'reviews:manage_team',
    'reports:read', 'reports:export',
    'self:payslips', 'self:leaves', 'self:profile', 'self:reviews',
  ],
  manager: [
    'employees:read',
    'leaves:read', 'leaves:approve', 'leaves:read_team',
    'reviews:manage_team',
    'reports:read',
    'self:payslips', 'self:leaves', 'self:profile', 'self:reviews',
  ],
  accountant: [
    'employees:read',
    'payroll:read',
    'payments:read', 'payments:validate',
    'payslips:read',
    'reports:read', 'reports:export',
    'audit:read',
    'compta:access',
    'self:payslips', 'self:leaves', 'self:profile', 'self:reviews',
  ],
  employee: ['self:payslips', 'self:leaves', 'self:profile', 'self:reviews'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

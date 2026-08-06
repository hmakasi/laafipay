import { UserRole, Permission } from '@/types';

// ============================================================
// Centralized permissions map — single source of truth
// ============================================================

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'employees:read',
    'employees:write',
    'employees:delete',
    'payroll:read',
    'payroll:write',
    'payroll:approve',
    'payroll:settings',
    'payments:read',
    'payments:initiate',
    'payments:validate',
    'payslips:read',
    'payslips:generate',
    'payslips:send',
    'leaves:read',
    'leaves:write',
    'leaves:approve',
    'leaves:read_team',
    'reports:read',
    'reports:export',
    'users:read',
    'users:write',
    'settings:read',
    'settings:write',
    'audit:read',
    'self:payslips',
    'self:leaves',
    'self:profile',
  ],

  hr_manager: [
    'employees:read',
    'employees:write',
    'payroll:read',
    'payroll:write',
    'payroll:approve',
    'payments:read',
    'payments:initiate',
    'payslips:read',
    'payslips:generate',
    'payslips:send',
    'leaves:read',
    'leaves:write',
    'leaves:approve',
    'leaves:read_team',
    'reports:read',
    'reports:export',
    'self:payslips',
    'self:leaves',
    'self:profile',
  ],

  manager: [
    'employees:read',
    'leaves:read',
    'leaves:approve',
    'leaves:read_team',
    'reports:read',
    'self:payslips',
    'self:leaves',
    'self:profile',
  ],

  accountant: [
    'employees:read',
    'payroll:read',
    'payments:read',
    'payments:validate',
    'payslips:read',
    'reports:read',
    'reports:export',
    'audit:read',
    'self:payslips',
    'self:leaves',
    'self:profile',
  ],

  employee: [
    'self:payslips',
    'self:leaves',
    'self:profile',
  ],
};

// ============================================================
// Navigation items visible per role
// ============================================================

export const ROLE_NAV_ITEMS: Record<UserRole, string[]> = {
  admin: [
    'dashboard',
    'employees',
    'payroll',
    'payments',
    'payslips',
    'leaves',
    'reports',
    'users',
    'settings',
    'audit',
  ],
  hr_manager: [
    'dashboard',
    'employees',
    'payroll',
    'payments',
    'payslips',
    'leaves',
    'reports',
  ],
  manager: [
    'dashboard',
    'employees',
    'leaves',
    'self',
  ],
  accountant: [
    'dashboard',
    'payroll',
    'payments',
    'payslips',
    'reports',
    'audit',
    'self',
  ],
  employee: [
    'self',
  ],
};

// ============================================================
// Permission checker functions
// ============================================================

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

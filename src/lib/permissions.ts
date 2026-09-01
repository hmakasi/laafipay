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
    'reviews:read',
    'reviews:write',
    'reviews:manage_team',
    'reports:read',
    'reports:export',
    'users:read',
    'users:write',
    'settings:read',
    'settings:write',
    'audit:read',
    'compta:access',
    'advances:read',
    'advances:approve',
    'self:payslips',
    'self:leaves',
    'self:profile',
    'self:reviews',
    'self:advances',
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
    'reviews:read',
    'reviews:write',
    'reviews:manage_team',
    'reports:read',
    'reports:export',
    'advances:read',
    'advances:approve',
    'self:payslips',
    'self:leaves',
    'self:profile',
    'self:reviews',
    'self:advances',
  ],

  manager: [
    'employees:read',
    'leaves:read',
    'leaves:approve',
    'leaves:read_team',
    'reviews:manage_team',
    'reports:read',
    'self:payslips',
    'self:leaves',
    'self:profile',
    'self:reviews',
    'self:advances',
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
    'compta:access',
    'advances:read',
    'advances:approve',
    'self:payslips',
    'self:leaves',
    'self:profile',
    'self:reviews',
    'self:advances',
  ],

  employee: [
    'self:payslips',
    'self:leaves',
    'self:profile',
    'self:reviews',
    'self:advances',
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
    'reviews',
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
    'reviews',
    'reports',
  ],
  // Pas d'"employees" ici : employees:read reste dans ROLE_PERMISSIONS
  // (nécessaire pour résoudre les noms dans les tableaux congés/entretiens
  // d'équipe, même pattern que "accountant" ci-dessous) mais un manager ne
  // doit voir que congés (validation d'équipe + sa propre demande),
  // entretiens annuels (son équipe) et reporting — pas l'annuaire complet.
  manager: [
    'dashboard',
    'leaves',
    'reviews',
    'reports',
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

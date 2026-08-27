import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Permission } from '@/types';
import { hasAllPermissions, hasAnyPermission } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';

interface PermissionGateProps {
  permission?: Permission;
  anyOf?: Permission[];
  allOf?: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}

function checkAccess(
  role: string | undefined,
  { permission, anyOf, allOf }: Pick<PermissionGateProps, 'permission' | 'anyOf' | 'allOf'>
): boolean {
  if (!role) return false;
  const r = role as Parameters<typeof hasAnyPermission>[0];
  if (permission) return hasAnyPermission(r, [permission]);
  if (anyOf) return hasAnyPermission(r, anyOf);
  if (allOf) return hasAllPermissions(r, allOf);
  return true;
}

export function PermissionGate({ permission, anyOf, allOf, fallback = null, children }: PermissionGateProps) {
  const role = useAuthStore((s) => s.user?.role);
  if (!checkAccess(role, { permission, anyOf, allOf })) return <>{fallback}</>;
  return <>{children}</>;
}

export function RequirePermission({ permission, anyOf, allOf, children }: Omit<PermissionGateProps, 'fallback'>) {
  const role = useAuthStore((s) => s.user?.role);
  if (!checkAccess(role, { permission, anyOf, allOf })) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// Distinct de RequirePermission : "admin LaafiPay" (équipe interne) n'a
// rien à voir avec le système de rôles/permissions par entreprise — voir
// server/src/lib/platformAdmin.ts.
export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const isPlatformAdmin = useAuthStore((s) => s.user?.isPlatformAdmin);
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

import {
  LayoutDashboard,
  Users,
  Wallet,
  Send,
  FileText,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
  UserCog,
  Settings,
  ShieldCheck,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {
  id: string;
  path: string;
  labelKey: string;
  icon: LucideIcon;
}

export const NAV_CONFIG: Record<string, NavItemConfig> = {
  dashboard: { id: 'dashboard', path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  employees: { id: 'employees', path: '/employees', labelKey: 'nav.employees', icon: Users },
  payroll: { id: 'payroll', path: '/payroll', labelKey: 'nav.payroll', icon: Wallet },
  payments: { id: 'payments', path: '/payments', labelKey: 'nav.payments', icon: Send },
  payslips: { id: 'payslips', path: '/payslips', labelKey: 'nav.payslips', icon: FileText },
  leaves: { id: 'leaves', path: '/leaves', labelKey: 'nav.leaves', icon: CalendarDays },
  reviews: { id: 'reviews', path: '/reviews', labelKey: 'nav.reviews', icon: ClipboardCheck },
  reports: { id: 'reports', path: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
  users: { id: 'users', path: '/users', labelKey: 'nav.users', icon: UserCog },
  settings: { id: 'settings', path: '/settings', labelKey: 'nav.settings', icon: Settings },
  audit: { id: 'audit', path: '/audit', labelKey: 'nav.audit', icon: ShieldCheck },
  self: { id: 'self', path: '/self', labelKey: 'nav.selfService', icon: UserCircle },
};

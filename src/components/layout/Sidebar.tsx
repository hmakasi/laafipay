import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { ROLE_NAV_ITEMS } from '@/lib/permissions';
import { NAV_CONFIG } from '@/lib/navConfig';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const items = role ? ROLE_NAV_ITEMS[role] ?? [] : [];

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <span className="text-lg font-bold text-primary">{t('app.name')}</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((itemId) => {
          const item = NAV_CONFIG[itemId];
          if (!item) return null;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  isActive && 'sidebar-active'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

import { NavLink } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { COMPTA_NAV_ITEMS } from '@/lib/comptaNavConfig';
import { cn } from '@/lib/utils';
import { mockWhatsAppDocuments } from '@/mocks/compta';

// Nombre de reçus WhatsApp en attente de validation, affiché en badge
// sur l'onglet du module — recalculé depuis les données mockées tant
// qu'il n'y a pas de requête serveur dédiée à ce compteur.
const PENDING_WHATSAPP_COUNT = mockWhatsAppDocuments.filter((d) => d.validationStatus === 'en_attente').length;

export function ComptaSidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <span className="text-lg font-bold text-primary">LaafiCompta</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {COMPTA_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/compta'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  isActive && 'sidebar-active'
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.id === 'compta-whatsapp' && PENDING_WHATSAPP_COUNT > 0 && (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  {PENDING_WHATSAPP_COUNT}
                </Badge>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

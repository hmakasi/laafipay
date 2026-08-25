import { useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, Wallet, Calculator } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Workspace = 'paie' | 'compta';

const WORKSPACES: Record<Workspace, { label: string; sub: string; icon: typeof Wallet; path: string }> = {
  paie: { label: 'LaafiPay', sub: 'Paie & RH', icon: Wallet, path: '/dashboard' },
  compta: { label: 'LaafiCompta', sub: 'Comptabilité SYSCOHADA', icon: Calculator, path: '/compta' },
};

// Sélecteur d'espace de travail entre les deux produits de l'écosystème.
// Implémenté comme un switch de route (`/dashboard` <-> `/compta`) au
// sein de la même app plutôt qu'un sous-domaine dédié : les deux
// dashboards restent des surfaces distinctes (layout, sidebar, thème
// propres — voir ComptaLayout) sans le coût d'infra d'un déploiement
// séparé par sous-domaine.
export function WorkspaceSwitcher({ current }: { current: Workspace }) {
  const navigate = useNavigate();
  const active = WORKSPACES[current];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent">
          <ActiveIcon className="h-4 w-4 text-primary" />
          <div className="text-left leading-tight">
            <div className="font-semibold">{active.label}</div>
            <div className="text-[11px] text-muted-foreground">{active.sub}</div>
          </div>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Espaces de travail</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.entries(WORKSPACES) as [Workspace, (typeof WORKSPACES)[Workspace]][]).map(([key, ws]) => {
          const Icon = ws.icon;
          const isActive = key === current;
          return (
            <DropdownMenuItem
              key={key}
              onClick={() => !isActive && navigate(ws.path)}
              className={cn('flex items-center gap-2 py-2', isActive && 'bg-accent')}
            >
              <Icon className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">{ws.label}</div>
                <div className="text-xs text-muted-foreground">{ws.sub}</div>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

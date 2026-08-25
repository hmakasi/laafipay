import { Outlet } from 'react-router-dom';
import { ComptaSidebar } from '@/components/compta/ComptaSidebar';
import { ComptaTopbar } from '@/components/compta/ComptaTopbar';

// Shell dédié à LaafiCompta : même structure que AppLayout (RH/Paie)
// mais sidebar/nav propres et classe `workspace-compta` qui retinte les
// tokens Tailwind (--primary, --ring, --sidebar-*) en bleu — voir
// index.css. Les deux dashboards partagent les primitives ui/ mais ne
// partagent ni navigation ni palette, pour rester des surfaces distinctes.
export function ComptaLayout() {
  return (
    <div className="workspace-compta flex h-screen overflow-hidden bg-background">
      <ComptaSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ComptaTopbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

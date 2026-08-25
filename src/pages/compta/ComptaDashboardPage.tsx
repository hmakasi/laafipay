import { ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency } from '@/lib/utils';
import { mockSynthesisTrend } from '@/mocks/compta';
import { PasserellePaieWidget } from '@/components/compta/PasserellePaieWidget';
import { WhatsAppAccountingHub } from '@/components/compta/WhatsAppAccountingHub';
import { TresorerieRapprochement } from '@/components/compta/TresorerieRapprochement';
import { CopiloteFiscalWidget } from '@/components/compta/CopiloteFiscalWidget';

const TRESORERIE_HUE = '#1a56db';
const VENTES_HUE = '#059669';
const ACHATS_HUE = '#dc2626';

const chartTooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
};

function SynthesisCard({
  icon: Icon,
  label,
  value,
  hue,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hue: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${hue}1a`, color: hue }}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComptaDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const latest = mockSynthesisTrend[mockSynthesisTrend.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          LaafiCompta
          <span className="ml-2 text-lg font-normal text-muted-foreground">— Comptabilité générale SYSCOHADA</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {user?.firstName}, tableau de bord de synthèse
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SynthesisCard icon={Wallet} label="Trésorerie" value={formatCurrency(latest.tresorerie)} hue={TRESORERIE_HUE} />
        <SynthesisCard icon={TrendingUp} label="Ventes du mois" value={formatCurrency(latest.ventes)} hue={VENTES_HUE} />
        <SynthesisCard icon={ShoppingCart} label="Achats du mois" value={formatCurrency(latest.achats)} hue={ACHATS_HUE} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trésorerie, ventes & achats — 6 derniers mois</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockSynthesisTrend} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" name="Trésorerie" dataKey="tresorerie" stroke={TRESORERIE_HUE} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" name="Ventes" dataKey="ventes" stroke={VENTES_HUE} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" name="Achats" dataKey="achats" stroke={ACHATS_HUE} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <PasserellePaieWidget />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WhatsAppAccountingHub />
        <CopiloteFiscalWidget />
      </div>

      <TresorerieRapprochement />
    </div>
  );
}

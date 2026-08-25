import {
  LayoutDashboard,
  ArrowLeftRight,
  MessageCircle,
  Landmark,
  ShieldAlert,
  BookOpen,
  FileBarChart,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface ComptaNavItemConfig {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
}

export const COMPTA_NAV_ITEMS: ComptaNavItemConfig[] = [
  { id: 'compta-dashboard', path: '/compta', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'compta-passerelle', path: '/compta/passerelle-paie', label: 'Passerelle Paie', icon: ArrowLeftRight },
  { id: 'compta-whatsapp', path: '/compta/whatsapp', label: 'WhatsApp Accounting', icon: MessageCircle },
  { id: 'compta-tresorerie', path: '/compta/tresorerie', label: 'Trésorerie & Rapprochement', icon: Landmark },
  { id: 'compta-fiscal', path: '/compta/fiscal', label: 'Copilote Fiscal', icon: ShieldAlert },
  { id: 'compta-journal', path: '/compta/journal', label: 'Journal & Écritures', icon: BookOpen },
  { id: 'compta-rapports', path: '/compta/rapports', label: 'États financiers', icon: FileBarChart },
  { id: 'compta-parametres', path: '/compta/parametres', label: 'Paramètres', icon: Settings },
];

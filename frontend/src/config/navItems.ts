import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  MessageSquare,
  Sparkles,
  BarChart2,
  FileText,
  Settings,
  Landmark,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',       label: 'Início',       icon: LayoutDashboard },
  { to: '/renda',           label: 'Renda',         icon: Wallet },
  { to: '/dividas',         label: 'Dívidas',       icon: CreditCard },
  { to: '/dividas/baixas',  label: 'Baixas',        icon: Receipt },
  { to: '/contas-pagar',    label: 'A Pagar',       icon: ArrowUpCircle },
  { to: '/contas-receber',  label: 'A Receber',     icon: ArrowDownCircle },
  { to: '/investimentos',        label: 'Investimentos', icon: TrendingUp },
  { to: '/contas-bancarias',     label: 'Contas e Cartões', icon: Landmark },
  { to: '/chat',                 label: 'Assistente IA', icon: MessageSquare },
  { to: '/plano-de-acao',   label: 'Plano IA',      icon: Sparkles },
  { to: '/relatorios',      label: 'Relatórios',    icon: BarChart2 },
  { to: '/relatorios?tab=extrato', label: 'Extrato', icon: FileText },
  { to: '/configuracoes',   label: 'Config.',       icon: Settings },
]

export const DEFAULT_SHORTCUTS = [
  '/dashboard',
  '/contas-pagar',
  '/dividas',
  '/renda',
  '/relatorios',
]

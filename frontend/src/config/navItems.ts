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
  Settings,
  Landmark,
  ListChecks,
  FileText,
  Tags,
  Crown,
  Target,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',       label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/renda',           label: 'Renda',              icon: Wallet },
  { to: '/metas',           label: 'Metas',              icon: Target },
  { to: '/dividas',         label: 'Dívidas',            icon: CreditCard },
  { to: '/dividas/baixas',  label: 'Baixas de Dívidas',  icon: Receipt },
  { to: '/contas-pagar',    label: 'Contas a Pagar',     icon: ArrowUpCircle },
  { to: '/contas-receber',  label: 'Contas a Receber',   icon: ArrowDownCircle },
  { to: '/investimentos',   label: 'Investimentos',      icon: TrendingUp },
  { to: '/contas-bancarias', label: 'Contas e Cartões',  icon: Landmark },
  { to: '/listas',          label: 'Listas',             icon: ListChecks },
  { to: '/categorias',      label: 'Categorias',         icon: Tags },
  { to: '/nfs',             label: 'Notas Fiscais (NFS)', icon: FileText },
  { to: '/chat',            label: 'Assistente IA',      icon: MessageSquare },
  { to: '/plano-de-acao',   label: 'Plano de Ação',      icon: Sparkles },
  { to: '/relatorios',      label: 'Relatórios',         icon: BarChart2 },
  { to: '/planos',          label: 'Meu Plano',          icon: Crown },
  { to: '/configuracoes',   label: 'Configurações',      icon: Settings },
]

export const DEFAULT_SHORTCUTS = [
  '/dashboard',
  '/contas-pagar',
  '/dividas',
  '/renda',
  '/relatorios',
]

export function requiresExactActiveMatch(path: string): boolean {
  return ALL_NAV_ITEMS.some((item) => item.to !== path && item.to.startsWith(`${path}/`))
}

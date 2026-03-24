import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, CreditCard, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'

interface DashboardResumo {
  renda_total: number
  total_despesas_fixas: number
  total_dividas: number
  total_dividas_ativas: number
  saldo_disponivel: number
  plano_gerado: boolean
}

function MetricCard({
  title,
  value,
  icon: Icon,
  colorClass = 'text-gray-700',
  bgClass = 'bg-white',
}: {
  title: string
  value: string
  icon: React.ElementType
  colorClass?: string
  bgClass?: string
}) {
  return (
    <div className={`card ${bgClass} flex items-center gap-4 p-4`}>
      <div className={`p-2 rounded-lg bg-gray-100 ${colorClass}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{title}</p>
        <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardResumo>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/resumo').then((r) => r.data),
    staleTime: 0,
  })

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-20 animate-pulse bg-gray-100" />
        ))}
      </div>
    )
  }

  const saldoPositivo = (data?.saldo_disponivel ?? 0) >= 0

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Visão geral</h1>
        <p className="text-sm text-gray-500">Seu resumo financeiro de hoje</p>
      </div>

      {/* Alertas */}

      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="Renda total"
          value={formatCurrency(data?.renda_total ?? 0)}
          icon={TrendingUp}
          colorClass="text-success-500"
        />
        <MetricCard
          title="Despesas fixas"
          value={formatCurrency(data?.total_despesas_fixas ?? 0)}
          icon={TrendingDown}
          colorClass="text-danger-500"
        />
        <MetricCard
          title="Total em dívidas"
          value={formatCurrency(data?.total_dividas ?? 0)}
          icon={CreditCard}
          colorClass="text-gray-700"
        />
        <MetricCard
          title="Saldo livre"
          value={formatCurrency(data?.saldo_disponivel ?? 0)}
          icon={saldoPositivo ? TrendingUp : TrendingDown}
          colorClass={saldoPositivo ? 'text-success-500' : 'text-danger-500'}
        />
      </div>

      {/* Data de liberdade — vem do plano ativo, não do dashboard */}

      {/* Banner de Plano IA */}
      <div className="card border-2 border-dashed border-primary-200 p-4 flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary-100 text-primary-500 shrink-0">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">
            {data?.plano_gerado ? 'Plano de ação ativo' : 'Gere seu plano de ação com IA'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {data?.plano_gerado
              ? 'Continue seguindo as recomendações para alcançar seu objetivo.'
              : 'Nossa IA analisa sua situação e cria um plano personalizado para quitar suas dívidas.'}
          </p>
        </div>
        <Link
          to="/plano-de-acao"
          className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap self-center"
        >
          {data?.plano_gerado ? 'Ver plano' : 'Gerar'}
        </Link>
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/renda" className="card p-4 text-center hover:bg-gray-50 transition-colors">
          <TrendingUp size={20} className="text-success-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-gray-700">Gerenciar renda</p>
        </Link>
        <Link to="/dividas" className="card p-4 text-center hover:bg-gray-50 transition-colors">
          <CreditCard size={20} className="text-gray-600 mx-auto mb-1" />
          <p className="text-sm font-medium text-gray-700">
            {data?.total_dividas_ativas ?? 0} dívida(s)
          </p>
        </Link>
      </div>
    </div>
  )
}

import React from 'react'
import { TrendingUp, TrendingDown, CreditCard, Sparkles, AlertTriangle, Clock, Wallet, Calendar, Landmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useDashboard } from '@/hooks/useDashboard'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/utils/format'
import { SkeletonList } from '@/components/ui/SkeletonList'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  colorClass?: string
  bgClass?: string
  to?: string
}

const MetricCard = React.memo(function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = 'text-gray-700',
  bgClass = 'bg-white',
  to,
}: MetricCardProps) {
  const content = (
    <div className={`card ${bgClass} flex items-center gap-3 p-3 ${to ? 'hover:bg-gray-50 transition-colors' : ''}`}>
      <div className={`p-1.5 rounded-lg bg-gray-100 ${colorClass}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{title}</p>
        <p className={`text-base font-bold ${colorClass}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
})

export default function DashboardPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const { resumo, contas: contasQuery, cartoes: cartoesQuery } = useDashboard()
  const { data, isLoading, isError } = resumo
  const contas = contasQuery.data ?? []
  const cartoes = cartoesQuery.data ?? []

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <SkeletonList count={4} height="h-20" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
        <p className="text-gray-600 font-medium mb-1">Não foi possível carregar o resumo</p>
        <p className="text-sm text-gray-400 mb-4">Verifique sua conexão e tente novamente.</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary px-6"
        >
          Recarregar
        </button>
        <button
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
          className="mt-3 rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sair
        </button>
      </div>
    )
  }

  const saldoPositivo = (data?.saldo_disponivel ?? 0) >= 0
  const saldoProjetadoPositivo = (data?.saldo_projetado_30d ?? 0) >= 0

  return (
    <div className="px-3 py-2 space-y-2 max-w-2xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Visão geral</h1>
        <p className="text-xs text-gray-500">Seu resumo financeiro de hoje</p>
      </div>

      {/* Alertas */}
      {(data?.parcelas_atrasadas_total ?? 0) > 0 && (
        <Link
          to="/dividas"
          className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5 hover:bg-red-100 transition-colors"
        >
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-700">
              {data!.parcelas_atrasadas_total === 1
                ? '1 parcela em atraso'
                : `${data!.parcelas_atrasadas_total} parcelas em atraso`}
              {data!.dividas_com_atraso > 1 ? ` em ${data!.dividas_com_atraso} dívidas` : ''}
            </p>
            <p className="text-xs text-red-600">
              Total: <strong>{formatCurrency(data!.valor_parcelas_atrasadas)}</strong>
            </p>
          </div>
        </Link>
      )}

      {/* Próxima conta a vencer */}
      {data?.proxima_conta_vencimento && (
        <Link
          to="/contas-pagar"
          className={`flex items-center gap-2 rounded-xl p-2.5 transition-colors ${
            (data.dias_proxima_conta ?? 0) < 0
              ? 'bg-red-50 border border-red-200 hover:bg-red-100'
              : 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Calendar size={14} className={`shrink-0 ${(data.dias_proxima_conta ?? 0) < 0 ? 'text-red-500' : 'text-amber-500'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${(data.dias_proxima_conta ?? 0) < 0 ? 'text-red-700' : 'text-amber-700'}`}>
              {(data.dias_proxima_conta ?? 0) < 0
                ? `Conta vencida há ${Math.abs(data.dias_proxima_conta!)} dia(s)`
                : data.dias_proxima_conta === 0
                ? 'Conta vence hoje'
                : data.dias_proxima_conta === 1
                ? 'Próxima conta vence em 1 dia'
                : `Próxima conta vence em ${data.dias_proxima_conta} dias`}
            </p>
            <p className={`text-xs ${(data.dias_proxima_conta ?? 0) < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              {formatDate(data.proxima_conta_vencimento)}
            </p>
          </div>
        </Link>
      )}

      {/* Métricas principais */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          title="Renda mensal"
          value={formatCurrency(data?.renda_total ?? 0)}
          icon={TrendingUp}
          colorClass="text-success-500"
          to="/renda"
        />
        <MetricCard
          title="Saldo livre"
          value={formatCurrency(data?.saldo_disponivel ?? 0)}
          icon={saldoPositivo ? Wallet : TrendingDown}
          colorClass={saldoPositivo ? 'text-success-500' : 'text-danger-500'}
        />
        <MetricCard
          title="A pagar (pendente)"
          value={formatCurrency(data?.total_a_pagar_30d ?? 0)}
          icon={TrendingDown}
          colorClass="text-danger-500"
          to="/contas-pagar"
        />
        <MetricCard
          title="A receber (30 dias)"
          value={formatCurrency(data?.total_a_receber_30d ?? 0)}
          icon={TrendingUp}
          colorClass="text-success-500"
          to="/contas-receber"
        />
      </div>

      {/* Projeção 30 dias */}
      <div className={`card p-3 border ${saldoProjetadoPositivo ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'}`}>
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${saldoProjetadoPositivo ? 'bg-green-100' : 'bg-red-100'}`}>
            <Clock size={16} className={saldoProjetadoPositivo ? 'text-success-500' : 'text-danger-500'} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">Saldo projetado 30 dias</p>
            <p className={`text-lg font-bold ${saldoProjetadoPositivo ? 'text-success-500' : 'text-danger-500'}`}>
              {formatCurrency(data?.saldo_projetado_30d ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Dívidas */}
      <MetricCard
        title="Total em dívidas"
        value={formatCurrency(data?.total_dividas ?? 0)}
        subtitle={`${data?.total_dividas_ativas ?? 0} dívida(s) ativa(s)`}
        icon={CreditCard}
        colorClass="text-gray-700"
        to="/dividas"
      />

      {/* Contas bancárias */}
      {contas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
              <Landmark size={12} /> Contas bancárias
            </p>
            <Link to="/contas-bancarias" className="text-xs text-primary-600 hover:underline">Ver todas</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {contas.slice(0, 4).map((conta) => (
              <Link
                key={conta.id}
                to={`/contas-bancarias/${conta.id}/lancamentos`}
                className="rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="p-2.5 text-white" style={{ backgroundColor: conta.cor }}>
                  <p className="text-xs opacity-80 truncate">{conta.banco}</p>
                  <p className="text-sm font-semibold truncate">{conta.nome}</p>
                  <p className="text-base font-bold mt-1">{formatCurrency(conta.saldo_inicial)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Cartões de crédito */}
      {cartoes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
              <CreditCard size={12} /> Cartões de crédito
            </p>
            <Link to="/contas-bancarias" className="text-xs text-primary-600 hover:underline">Ver todos</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cartoes.slice(0, 4).map((cartao) => (
              <Link
                key={cartao.id}
                to={`/cartoes-credito/${cartao.id}/lancamentos`}
                className="rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="p-2.5 text-white" style={{ backgroundColor: cartao.cor }}>
                  <p className="text-xs opacity-80 truncate capitalize">{cartao.bandeira}</p>
                  <p className="text-sm font-semibold truncate">{cartao.nome}</p>
                  <p className="text-base font-bold mt-1">{formatCurrency(cartao.limite)}</p>
                  <p className="text-xs opacity-70">Limite total</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Banner de Plano IA */}
      <div className="card w-full max-w-full box-border border-2 border-dashed border-primary-200 p-3 px-4 pb-20 flex items-center gap-3">
        <div className="p-1.5 rounded-full bg-primary-100 text-primary-500 shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0 w-full max-w-full box-border px-4 break-words [word-break:normal]">
          <p className="font-semibold text-gray-800 text-xs">
            {data?.plano_gerado ? 'Plano de ação ativo' : 'Gere seu plano de ação com IA'}
          </p>
          <p className="text-xs text-gray-500 break-words [word-break:normal]">
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
    </div>
  )
}

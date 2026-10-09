import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Crown, Loader2, QrCode, X } from 'lucide-react'
import { cancelarAssinatura, listarPlanos, minhaAssinatura } from '@/services/api'
import { usePlano } from '@/hooks/usePlano'
import { PageHeader } from '@/components/ui/PageHeader'
import CheckoutModal from '@/components/planos/CheckoutModal'
import type { PlanoEntitlements } from '@/types/financeiro'

function preco(v: number): string {
  if (v === 0) return 'Grátis'
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function valorLimite(p: PlanoEntitlements, recurso: string, srIlimitado = 'Ilimitado'): string {
  const v = p.limites[recurso]
  return v === null || v === undefined ? srIlimitado : String(v)
}

function tem(p: PlanoEntitlements, recurso: string): 'sim' | 'nao' {
  return p.recursos.includes(recurso) ? 'sim' : 'nao'
}

interface Linha {
  grupo: string
  rotulo: string
  valor: (p: PlanoEntitlements) => string
}

const LINHAS: Linha[] = [
  { grupo: 'Organização', rotulo: 'Rendas e contas', valor: (p) => valorLimite(p, 'rendas', 'Ilimitado') },
  { grupo: 'Organização', rotulo: 'Dívidas ativas', valor: (p) => valorLimite(p, 'dividas_ativas') },
  { grupo: 'Organização', rotulo: 'Cartões de crédito', valor: (p) => valorLimite(p, 'cartoes_credito') },
  { grupo: 'Organização', rotulo: 'Contas bancárias', valor: (p) => (tem(p, 'contas_bancarias') === 'sim' ? 'Incluído' : 'Não incluído') },
  { grupo: 'Organização', rotulo: 'Investimentos', valor: (p) => (p.recursos.includes('investimentos') ? 'Incluído' : 'Não incluído') },
  { grupo: 'IA', rotulo: 'Plano de Ação IA', valor: (p) => valorLimite(p, 'planos_ia_mes', 'Ilimitado') },
  { grupo: 'IA', rotulo: 'Chat IA', valor: (p) => valorLimite(p, 'chat_msgs_mes', 'Ilimitado') },
  { grupo: 'IA', rotulo: 'Assistente de voz', valor: (p) => (p.recursos.includes('voz') ? 'Incluído' : 'Não incluído') },
  { grupo: 'IA', rotulo: 'Prioridade na IA', valor: (p) => (p.recursos.includes('ia_prioridade') ? 'Incluído' : '—') },
  { grupo: 'Relatórios', rotulo: 'Relatório detalhado', valor: (p) => (p.recursos.includes('relatorios_avancados') ? 'Incluído' : 'Não incluído') },
  { grupo: 'Relatórios', rotulo: 'Exportação Excel/PDF', valor: (p) => (p.recursos.includes('exportacao') ? 'Incluído' : 'Não incluído') },
  { grupo: 'Avançado', rotulo: 'Notas Fiscais (NFS-e)', valor: (p) => (p.recursos.includes('nfs') ? 'Incluído' : 'Não incluído') },
  { grupo: 'Avançado', rotulo: 'Membros no espaço', valor: (p) => (p.recursos.includes('multiusuario') ? 'Até 6 membros' : 'Não incluído') },
  { grupo: 'Suporte', rotulo: 'Suporte', valor: (p) => (p.nome === 'gratuito' ? 'Comunidade' : p.nome === 'pro' ? 'Prioritário' : 'E-mail') },
]

const GRUPOS = ['Organização', 'IA', 'Relatórios', 'Avançado', 'Suporte']

const STATUS_PAGAMENTO_LABEL: Record<string, { label: string; cor: string }> = {
  pendente: { label: 'Pendente', cor: 'bg-amber-100 text-amber-700' },
  pago: { label: 'Pago', cor: 'bg-green-100 text-green-700' },
  recusado: { label: 'Recusado', cor: 'bg-red-100 text-red-700' },
  cancelado: { label: 'Cancelado', cor: 'bg-gray-100 text-gray-600' },
}

export default function PlanosPage() {
  const { data: catalogo, isLoading } = useQuery({
    queryKey: ['planos-catalogo'],
    queryFn: listarPlanos,
  })
  const { plano: planoAtual, rotulo } = usePlano()
  const queryClient = useQueryClient()
  const [assinando, setAssinando] = useState<PlanoEntitlements | null>(null)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)

  const { data: assinaturaData } = useQuery({
    queryKey: ['minha-assinatura'],
    queryFn: minhaAssinatura,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    )
  }

  const planos = catalogo ?? []
  const assinatura = assinaturaData?.assinatura ?? null

  function invalidarAssinatura() {
    queryClient.invalidateQueries({ queryKey: ['meu-plano'] })
    queryClient.invalidateQueries({ queryKey: ['minha-assinatura'] })
  }

  async function handleCancelar() {
    try {
      await cancelarAssinatura()
      setConfirmandoCancelamento(false)
      invalidarAssinatura()
    } catch {
      setConfirmandoCancelamento(false)
    }
  }

  return (
    <div className="w-full mx-auto max-w-4xl p-4 space-y-6">
      <PageHeader title="Planos e assinaturas" subtitle={`Seu plano atual: ${rotulo}`} />

      {/* Cards de preço */}
      <div className="grid gap-4 md:grid-cols-3">
        {planos.map((plano) => {
          const ehAtual = plano.nome === planoAtual
          return (
            <div
              key={plano.nome}
              className="card p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">{plano.rotulo}</h3>
                {ehAtual && (
                  <span className="text-xs font-semibold text-primary-500 bg-primary-100 rounded-full px-2 py-0.5">
                    Seu plano
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 min-h-[40px]">{plano.descricao}</p>
              <div>
                <span className="text-2xl font-extrabold text-gray-800">{preco(plano.preco_mensal)}</span>
                {plano.preco_mensal > 0 && <span className="text-sm text-gray-500">/mês</span>}
                {plano.preco_anual > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {preco(plano.preco_anual)}/ano (2 meses grátis)
                  </p>
                )}
              </div>
              {ehAtual ? (
                <p className="btn-secondary w-full text-center cursor-default py-2.5 rounded-xl text-sm font-medium">
                  Plano atual
                </p>
              ) : (
                <button
                  onClick={() => setAssinando(plano)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Crown size={16} />
                  Assinar {plano.rotulo}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Minha assinatura */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-primary-500" />
            <h2 className="font-semibold text-gray-800">Minha assinatura</h2>
          </div>
          {assinatura && (
            <span className="text-xs font-semibold text-primary-500 bg-primary-100 rounded-full px-2 py-0.5">
              Ativa · até{' '}
              {assinatura.data_proxima_cobranca
                ? new Date(assinatura.data_proxima_cobranca).toLocaleDateString('pt-BR')
                : '—'}
            </span>
          )}
        </div>

        {assinatura ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-gray-800">{assinatura.rotulo}</p>
                <p className="text-xs text-gray-500">
                  {preco(assinatura.preco_mensal)}/mês · início em{' '}
                  {assinatura.data_inicio ? new Date(assinatura.data_inicio).toLocaleDateString('pt-BR') : '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => (confirmandoCancelamento ? handleCancelar() : setConfirmandoCancelamento(true))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  confirmandoCancelamento ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600 border border-red-200 hover:bg-red-50'
                }`}
              >
                <X size={14} />
                {confirmandoCancelamento ? 'Confirmar cancelamento' : 'Cancelar assinatura'}
              </button>
            </div>
            {confirmandoCancelamento && (
              <p className="text-xs text-gray-500">
                Ao cancelar, você volta ao plano Gratuito imediatamente e perde o acesso aos recursos pagos.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Você está no plano <strong>Gratuito</strong>. Assine o Premium ou o Pro/Família para desbloquear todos os recursos.
          </p>
        )}

        {assinaturaData && assinaturaData.pagamentos.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Pagamentos recentes</p>
            <div className="divide-y divide-gray-100">
              {assinaturaData.pagamentos.slice(0, 5).map((p) => {
                const status = STATUS_PAGAMENTO_LABEL[p.status] ?? { label: p.status, cor: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={p.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {p.metodo === 'pix' ? (
                        <QrCode size={15} className="text-gray-400" />
                      ) : (
                        <CreditCard size={15} className="text-gray-400" />
                      )}
                      <div>
                        <p className="text-sm text-gray-700">
                          {p.metodo === 'pix' ? 'PIX' : 'Cartão'} · {preco(p.valor)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : ''}
                          {p.pago_em ? ` · pago em ${new Date(p.pago_em).toLocaleDateString('pt-BR')}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${status.cor}`}>{status.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Comparativo */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="p-3 font-medium">Recurso</th>
              {planos.map((p) => (
                <th key={p.nome} className="p-3 font-semibold text-gray-700 whitespace-nowrap">
                  {p.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map((grupo) => (
              <Fragment key={grupo}>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                    {grupo}
                  </td>
                </tr>
                {LINHAS.filter((l) => l.grupo === grupo).map((linha) => (
                  <tr key={linha.rotulo} className="border-b border-gray-50">
                    <td className="p-3 text-gray-700">{linha.rotulo}</td>
                    {planos.map((p) => (
                      <td key={p.nome} className={`p-3 whitespace-nowrap ${p.nome === planoAtual ? 'text-primary-500 font-medium' : 'text-gray-600'}`}>
                        {linha.valor(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-center">
        PIX e cartão de crédito. Cancelamento quando quiser. Valores em reais (BRL).
      </p>

      <div className="text-center">
        <Link to="/" className="text-sm text-primary-500 hover:underline">
          Voltar ao app
        </Link>
      </div>

      {assinando && (
        <CheckoutModal
          plano={assinando}
          onClose={() => setAssinando(null)}
          onAtivado={() => {
            setAssinando(null)
            invalidarAssinatura()
          }}
        />
      )}
    </div>
  )
}
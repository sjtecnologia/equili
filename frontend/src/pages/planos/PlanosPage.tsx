import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Crown,
  Loader2,
  QrCode,
  RotateCcw,
  X,
} from 'lucide-react'
import { cancelarAssinatura, listarPlanos, minhaAssinatura } from '@/services/api'
import {
  carregarOfertasIap,
  comprarPacoteIap,
  iapCancelado,
  iapDisponivel,
  mensagemErroIap,
  restaurarComprasIap,
  type OfertasIap,
  type PacoteIap,
  type PeriodicidadeIap,
  type PlanoIap,
} from '@/services/iap'
import { usePlano } from '@/hooks/usePlano'
import { useAuthStore } from '@/stores/authStore'
import { PageHeader } from '@/components/ui/PageHeader'
import CheckoutModal from '@/components/planos/CheckoutModal'
import type { PlanoEntitlements } from '@/types/financeiro'

const LINK_GERENCIAR_APP_STORE = 'https://apps.apple.com/account/subscriptions'

function preco(v: number): string {
  if (v === 0) return 'Grátis'
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function nomeDoPlano(plano: string | null | undefined): string {
  if (plano === 'pro') return 'Pro / Família'
  if (plano === 'premium') return 'Premium'
  return 'Gratuito'
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
  const usuarioId = useAuthStore((s) => s.user?.id)
  const queryClient = useQueryClient()
  const [assinando, setAssinando] = useState<PlanoEntitlements | null>(null)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const isIosApp = iapDisponivel()

  const [ofertasIap, setOfertasIap] = useState<OfertasIap | null>(null)
  const [carregandoOfertas, setCarregandoOfertas] = useState(isIosApp)
  const [erroOfertas, setErroOfertas] = useState<string | null>(null)
  const [comprando, setComprando] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const [mensagemIap, setMensagemIap] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [periodicidade, setPeriodicidade] = useState<Record<string, PeriodicidadeIap>>({})

  const { data: assinaturaData } = useQuery({
    queryKey: ['minha-assinatura'],
    queryFn: minhaAssinatura,
  })

  useEffect(() => {
    if (!isIosApp || !usuarioId) return
    let ativo = true

    setCarregandoOfertas(true)
    setErroOfertas(null)
    carregarOfertasIap(usuarioId)
      .then((ofertas) => {
        if (ativo) setOfertasIap(ofertas)
      })
      .catch((erro: unknown) => {
        if (ativo) setErroOfertas(mensagemErroIap(erro))
      })
      .finally(() => {
        if (ativo) setCarregandoOfertas(false)
      })

    return () => {
      ativo = false
    }
  }, [isIosApp, usuarioId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    )
  }

  const planos = catalogo ?? []
  const assinatura = assinaturaData?.assinatura ?? null
  const assinaturaAppStore = assinatura?.gateway === 'revenuecat'

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

  function periodoSelecionado(plano: PlanoIap): PeriodicidadeIap {
    const oferta = ofertasIap?.[plano]
    const escolhido = periodicidade[plano]
    if (escolhido && oferta?.[escolhido]) return escolhido
    if (oferta?.mensal) return 'mensal'
    if (oferta?.anual) return 'anual'
    return 'mensal'
  }

  async function handleComprar(pacote: PacoteIap) {
    const chave = `${pacote.plano}-${pacote.periodicidade}`
    setComprando(chave)
    setMensagemIap(null)
    try {
      const resultado = await comprarPacoteIap(pacote)
      invalidarAssinatura()
      setMensagemIap(
        resultado.sincronizado
          ? {
              tipo: 'ok',
              texto: `Assinatura ${nomeDoPlano(resultado.plano)} ativada. Obrigado!`,
            }
          : {
              tipo: 'ok',
              texto:
                'Compra concluída. A App Store está confirmando a assinatura; seu plano será atualizado em instantes.',
            },
      )
    } catch (erro: unknown) {
      if (!iapCancelado(erro)) {
        setMensagemIap({ tipo: 'erro', texto: mensagemErroIap(erro) })
      }
    } finally {
      setComprando(null)
    }
  }

  async function handleRestaurar() {
    if (!usuarioId) return
    setRestaurando(true)
    setMensagemIap(null)
    try {
      const resultado = await restaurarComprasIap(usuarioId)
      invalidarAssinatura()
      setMensagemIap(
        resultado.plano
          ? {
              tipo: 'ok',
              texto: `Compras restauradas. Seu plano é ${nomeDoPlano(resultado.plano)}.`,
            }
          : {
              tipo: 'erro',
              texto:
                'Nenhuma assinatura ativa foi encontrada nesta conta Apple. Se você acabou de assinar, aguarde alguns instantes e tente novamente.',
            },
      )
    } catch (erro: unknown) {
      setMensagemIap({ tipo: 'erro', texto: mensagemErroIap(erro) })
    } finally {
      setRestaurando(false)
    }
  }

  return (
    <div className="w-full mx-auto max-w-4xl p-4 space-y-6">
      <PageHeader title="Planos e assinaturas" subtitle={`Seu plano atual: ${rotulo}`} />

      {isIosApp && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 leading-relaxed">
          As assinaturas abaixo são vendidas pela App Store. O pagamento é cobrado na sua conta
          Apple ID na confirmação da compra e a assinatura renova automaticamente pelo mesmo valor
          e período, salvo cancelamento até 24 horas antes do fim do período atual.
        </div>
      )}

      {/* Cards de preço */}
      <div className="grid gap-4 md:grid-cols-3">
        {planos.map((plano) => {
          const ehAtual = plano.nome === planoAtual
          const ehAssinavel = plano.nome === 'premium' || plano.nome === 'pro'
          const oferta = ehAssinavel ? ofertasIap?.[plano.nome as PlanoIap] : undefined
          const periodo = ehAssinavel ? periodoSelecionado(plano.nome as PlanoIap) : 'mensal'
          const pacote = oferta?.[periodo]
          const chaveCompra = pacote ? `${pacote.plano}-${pacote.periodicidade}` : null
          const comprandoEste = chaveCompra !== null && comprando === chaveCompra

          return (
            <div key={plano.nome} className="card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">{plano.rotulo}</h3>
                {ehAtual && (
                  <span className="text-xs font-semibold text-primary-500 bg-primary-100 rounded-full px-2 py-0.5">
                    Seu plano
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 min-h-[40px]">{plano.descricao}</p>

              {isIosApp && ehAssinavel ? (
                <div className="space-y-3">
                  {carregandoOfertas ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 size={15} className="animate-spin" />
                      Carregando preços da App Store…
                    </div>
                  ) : oferta ? (
                    <>
                      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                        {(['mensal', 'anual'] as PeriodicidadeIap[]).map((p) => {
                          const disponivel = Boolean(oferta[p])
                          return (
                            <button
                              key={p}
                              type="button"
                              disabled={!disponivel}
                              onClick={() =>
                                setPeriodicidade((atual) => ({
                                  ...atual,
                                  [plano.nome]: p,
                                }))
                              }
                              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                                periodo === p
                                  ? 'bg-white text-gray-800 shadow-xs'
                                  : 'text-gray-500 disabled:opacity-40'
                              }`}
                            >
                              {p === 'mensal' ? 'Mensal' : 'Anual'}
                            </button>
                          )
                        })}
                      </div>

                      <div>
                        <span className="text-2xl font-extrabold text-gray-800">
                          {pacote?.precoFormatado ?? '—'}
                        </span>
                        {pacote && (
                          <span className="text-sm text-gray-500">
                            /{pacote.periodicidade === 'mensal' ? 'mês' : 'ano'}
                          </span>
                        )}
                        {pacote?.periodicidade === 'anual' && (
                          <p className="text-xs text-gray-400 mt-0.5">Cobrado uma vez por ano</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Assinatura indisponível no momento. Tente novamente mais tarde.
                    </p>
                  )}

                  {ehAtual ? (
                    <p className="btn-secondary w-full text-center cursor-default py-2.5 rounded-xl text-sm font-medium">
                      Plano atual
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={!pacote || comprando !== null || !usuarioId}
                      onClick={() => pacote && handleComprar(pacote)}
                      className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {comprandoEste ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Crown size={16} />
                      )}
                      {pacote
                        ? `Assinar ${pacote.periodicidade === 'mensal' ? 'mensal' : 'anual'}`
                        : 'Assinar'}
                    </button>
                  )}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          )
        })}
      </div>

      {isIosApp && (
        <div className="space-y-3">
          {erroOfertas && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {erroOfertas}
            </div>
          )}

          {mensagemIap && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                mensagemIap.tipo === 'ok'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {mensagemIap.tipo === 'ok' ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : (
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
              )}
              {mensagemIap.texto}
            </div>
          )}

          <button
            type="button"
            onClick={handleRestaurar}
            disabled={restaurando || !usuarioId}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {restaurando ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            Restaurar compras
          </button>
        </div>
      )}

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
                  {assinaturaAppStore
                    ? 'Assinatura gerenciada pela App Store'
                    : `${preco(assinatura.preco_mensal)}/mês`}{' '}
                  · início em{' '}
                  {assinatura.data_inicio
                    ? new Date(assinatura.data_inicio).toLocaleDateString('pt-BR')
                    : '—'}
                </p>
              </div>
              {assinaturaAppStore ? (
                <a
                  href={LINK_GERENCIAR_APP_STORE}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors"
                >
                  Gerenciar na App Store
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => (confirmandoCancelamento ? handleCancelar() : setConfirmandoCancelamento(true))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    confirmandoCancelamento
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'text-red-600 border border-red-200 hover:bg-red-50'
                  }`}
                >
                  <X size={14} />
                  {confirmandoCancelamento ? 'Confirmar cancelamento' : 'Cancelar assinatura'}
                </button>
              )}
            </div>
            {confirmandoCancelamento && !assinaturaAppStore && (
              <p className="text-xs text-gray-500">
                Ao cancelar, você volta ao plano Gratuito imediatamente e perde o acesso aos recursos pagos.
              </p>
            )}
            {assinaturaAppStore && (
              <p className="text-xs text-gray-500">
                Para cancelar ou alterar a assinatura, use Ajustes &gt; Apple ID &gt; Assinaturas no
                seu iPhone. O acesso permanece até o fim do período já pago.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Você está no plano <strong>Gratuito</strong>. Assine o Premium ou o Pro / Família para
            desbloquear todos os recursos.
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

      {isIosApp ? (
        <div className="space-y-2 text-center text-xs text-gray-400 leading-relaxed">
          <p>
            Assinaturas com renovação automática. O pagamento será cobrado na sua conta Apple ID na
            confirmação da compra. A renovação ocorre até 24 horas antes do fim do período atual e
            pode ser cancelada em Ajustes &gt; Apple ID &gt; Assinaturas.
          </p>
          <p>
            Ao assinar, você concorda com os{' '}
            <Link to="/termos" className="text-primary-500 hover:underline">
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link to="/privacidade" className="text-primary-500 hover:underline">
              Política de Privacidade
            </Link>
            . Reembolsos são tratados pela Apple.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center">
          PIX e cartão de crédito. Cancelamento quando quiser. Valores em reais (BRL).
        </p>
      )}

      <div className="text-center">
        <Link to="/" className="text-sm text-primary-500 hover:underline">
          Voltar ao app
        </Link>
      </div>

      {!isIosApp && assinando && (
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

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  Crown,
  Loader2,
  Mail,
  MailPlus,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react'
import {
  aceitarConviteFamilia,
  cancelarConviteFamilia,
  convidarParaFamilia,
  minhaFamilia,
  removerMembroFamilia,
  sairDaFamilia,
} from '@/services/api'
import { PageHeader } from '@/components/ui/PageHeader'

function errMsg(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
  return detail || fallback
}

export default function FamiliaPage() {
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const tokenUrl = params.get('convite')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null) // membro/convite
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const [aceitando, setAceitando] = useState(false)

  const { data: familia, isLoading, refetch } = useQuery({
    queryKey: ['minha-familia'],
    queryFn: minhaFamilia,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    )
  }

  const papel = familia?.papel ?? 'nenhum'
  const limite = familia?.limite_membros ?? 6
  const ocupadas = (familia?.convites?.length ?? 0) + (familia?.membros?.length ?? 0)

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['minha-familia'] })
    queryClient.invalidateQueries({ queryKey: ['meu-plano'] })
  }

  function linkConvite(token: string | null): string {
    return token ? `${window.location.origin}/familia?convite=${token}` : ''
  }

  async function copiarLink(token: string | null, id: string) {
    const link = linkConvite(token)
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 1600)
  }

  async function convidar() {
    setEnviando(true)
    setErro(null)
    try {
      await convidarParaFamilia(email)
      setEmail('')
      invalidar()
      await refetch()
    } catch (e) {
      setErro(errMsg(e, 'Não foi possível enviar o convite.'))
    } finally {
      setEnviando(false)
    }
  }

  async function cancelarConvite(id: string) {
    try {
      await cancelarConviteFamilia(id)
      invalidar()
      await refetch()
    } catch (e) {
      setErro(errMsg(e, 'Não foi possível cancelar o convite.'))
    }
  }

  async function removerMembro(id: string) {
    try {
      await removerMembroFamilia(id)
      invalidar()
      await refetch()
    } catch (e) {
      setErro(errMsg(e, 'Não foi possível remover o membro.'))
    }
  }

  async function aceitar(token: string) {
    setAceitando(true)
    setErro(null)
    try {
      await aceitarConviteFamilia(token)
      invalidar()
      await refetch()
    } catch (e) {
      setErro(errMsg(e, 'Não foi possível aceitar o convite. Verifique se o e-mail do convite é o mesmo do seu login.'))
    } finally {
      setAceitando(false)
    }
  }

  async function sair() {
    setAceitando(true)
    try {
      await sairDaFamilia()
      invalidar()
      await refetch()
    } catch (e) {
      setErro(errMsg(e, 'Não foi possível sair da família.'))
    } finally {
      setAceitando(false)
    }
  }

  const tokenParaAceitar = papel === 'convidado' ? familia?.convite?.token ?? tokenUrl : tokenUrl

  return (
    <div className="w-full mx-auto max-w-2xl p-4 space-y-5">
      <PageHeader
        title="Família"
        subtitle="Convide quem mora com você — cada um com login e dados próprios, 1 assinatura para todos."
      />

      {/* ── Convidado: aceitar convite ── */}
      {papel === 'convidado' && tokenParaAceitar && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Mail size={20} className="text-primary-500" />
            <h2 className="font-semibold text-gray-800">Você foi convidado(a)!</h2>
          </div>
          <p className="text-sm text-gray-600">
            <strong>{familia?.titular?.nome}</strong> ({familia?.titular?.email}) quer
            compartilhar o plano <strong>Pro / Família</strong> com você. Aceitando, você
            ganha todos os recursos do plano — e continua com seus próprios dados e login.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => aceitar(tokenParaAceitar)}
              disabled={aceitando}
              className="btn-primary flex items-center gap-2"
            >
              {aceitando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Aceitar convite
            </button>
            <Link to="/planos" className="btn-secondary flex items-center gap-2">
              Ver planos
            </Link>
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{erro}</p>}
        </div>
      )}

      {/* ── Membro: contexto da família ── */}
      {papel === 'membro' && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary-500" />
            <h2 className="font-semibold text-gray-800">Você faz parte da família</h2>
          </div>
          <p className="text-sm text-gray-600">
            Gerenciada por <strong>{familia?.titular?.nome}</strong> ({familia?.titular?.email}).
            Seu plano <strong>Pro / Família</strong> está ativo com os dados da sua própria conta.
          </p>
          {familia && familia.membros.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Integrantes ({familia.membros.length})</p>
              <div className="space-y-1.5">
                {familia.membros.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.nome ?? m.email}</p>
                      <p className="text-xs text-gray-500 truncate">{m.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => (confirmandoSaida ? sair() : setConfirmandoSaida(true))}
            disabled={aceitando}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              confirmandoSaida ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600 border border-red-200 hover:bg-red-50'
            }`}
          >
            <UserMinus size={16} />
            {confirmandoSaida ? 'Confirmar saída da família' : 'Sair da família'}
          </button>
          {confirmandoSaida && (
            <p className="text-xs text-gray-500">
              Ao sair, seu acesso ao plano Pro é removido. Se você tiver assinatura própria, ela continua.
            </p>
          )}
          {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{erro}</p>}
        </div>
      )}

      {/* ── Titular: convites e membros ── */}
      {papel === 'titular' && (
        <>
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-primary-500" />
                <h2 className="font-semibold text-gray-800">Convidar membros</h2>
              </div>
              <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                {ocupadas} de {limite} vagas ocupadas
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Cada membro cria a própria conta (mesmo e-mail do convite) e mantém dados e login separados.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email-do-membro@exemplo.com"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
              <button
                onClick={convidar}
                disabled={enviando || !email}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                {enviando ? <Loader2 size={16} className="animate-spin" /> : <MailPlus size={16} />}
                Convidar
              </button>
            </div>
            {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{erro}</p>}
          </div>

          {familia && (familia.convites.length > 0 || familia.membros.length > 0) && (
            <div className="card p-5 space-y-4">
              {familia.convites.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Convites pendentes</p>
                  <div className="space-y-2">
                    {familia.convites.map((c) => (
                      <div key={c.id} className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{c.email}</p>
                            <p className="text-xs text-gray-500">Aguardando aceite</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copiarLink(c.token, c.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-primary-500 border border-primary-200 hover:bg-primary-50"
                            >
                              {copiadoId === c.id ? <Check size={13} /> : <Copy size={13} />}
                              {copiadoId === c.id ? 'Copiado!' : 'Copiar link'}
                            </button>
                            <button
                              onClick={() => (confirmandoId === c.id ? cancelarConvite(c.id) : setConfirmandoId(c.id))}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50"
                            >
                              <Trash2 size={13} />
                              {confirmandoId === c.id ? 'Confirmar' : 'Cancelar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {familia.membros.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Membros ativos</p>
                  <div className="space-y-2">
                    {familia.membros.map((m) => (
                      <div key={m.id} className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {m.nome ?? '—'} {m.nome ? <span className="text-gray-400 font-normal">· {m.email}</span> : ''}
                            </p>
                            <p className="text-xs text-gray-500">
                              Desde {m.aceito_em ? new Date(m.aceito_em).toLocaleDateString('pt-BR') : '—'} · plano Pro via família
                            </p>
                          </div>
                          <button
                            onClick={() => (confirmandoId === m.id ? removerMembro(m.id) : setConfirmandoId(m.id))}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-600 border border-red-200 hover:bg-red-50"
                          >
                            <UserMinus size={13} />
                            {confirmandoId === m.id ? 'Confirmar' : 'Remover'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Sem acesso: upsel para o Pro / Família ── */}
      {papel === 'nenhum' && (
        <div className="card p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
            <Users size={24} className="text-primary-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-800">Família e multi-usuário</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              No plano <strong>Pro / Família</strong> você convida até {limite} pessoas — cada uma com
              login e dados próprios, tudo com uma única assinatura (R$ 34,90/mês).
            </p>
          </div>
          <Link to="/planos" className="btn-primary inline-flex items-center gap-2 justify-center">
            <Crown size={16} />
            Assinar o Pro / Família
          </Link>
          {tokenUrl && (
            <p className="text-xs text-gray-400">
              Este convite será aceito com a conta que usa o mesmo e-mail informado no convite.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
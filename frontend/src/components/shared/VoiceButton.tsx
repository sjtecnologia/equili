/**
 * VoiceButton — Assistente de voz flutuante.
 * Usa a Web Speech API (disponível em iOS 13+ WKWebView e Android Chrome).
 */
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Mic, MicOff, X, Check, Loader2 } from 'lucide-react'
import api from '@/services/api'

// Helper para requisições com timeout de 12s no assistente de voz
function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: servidor demorou demais.')), ms)
    ),
  ])
}

type Estado = 'idle' | 'ouvindo' | 'processando' | 'confirmando' | 'pedindo_data' | 'ouvindo_data' | 'erro'

interface Acao {
  acao: string
  dados: Record<string, string | number | boolean | null | undefined>
  mensagem: string
}

// Mapa de ação → rota de API
const ROTAS: Record<string, string> = {
  criar_conta_pagar: '/contas-pagar',
  criar_conta_receber: '/contas-receber',
  criar_renda: '/rendas',
  atualizar_renda: '/rendas',
  excluir_conta_pagar: '/contas-pagar',
  excluir_conta_receber: '/contas-receber',
  excluir_renda: '/rendas',
}

const LABELS_MODALIDADE: Record<string, string> = {
  avulsa: 'Avulsa',
  recorrente: 'Recorrente (todo mês)',
  parcelada: 'Parcelada / Financiamento',
}

// Mapa de ação → campos que o endpoint espera
function prepararDados(acao: string, dados: Record<string, unknown>, dataExtra?: string) {
  if (acao === 'criar_conta_pagar') {
    return {
      descricao: dados.descricao,
      valor: dados.valor,
      data_vencimento: dataExtra || dados.data_vencimento,
      categoria: dados.categoria || 'outro',
      modalidade: dados.modalidade || 'avulsa',
    }
  }
  if (acao === 'criar_conta_receber') {
    return {
      descricao: dados.descricao,
      valor: dados.valor,
      data_vencimento: dataExtra || dados.data_vencimento,
    }
  }
  if (acao === 'criar_renda') {
    return {
      descricao: dados.descricao,
      valor: dados.valor,
      tipo: dados.tipo || 'salario',
      frequencia: dados.frequencia || 'mensal',
    }
  }
  return dados
}

// Rota para navegar após ação
const NAVEGACAO: Record<string, string> = {
  criar_conta_pagar: '/contas-pagar',
  criar_conta_receber: '/contas-receber',
  criar_renda: '/renda',
  atualizar_renda: '/renda',
  excluir_conta_pagar: '/contas-pagar',
  excluir_conta_receber: '/contas-receber',
  excluir_renda: '/renda',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = Window & typeof globalThis & Record<string, any>

export default function VoiceButton() {
  const [estado, setEstado] = useState<Estado>('idle')
  const transcricaoRef = useRef('')
  const [transcricao, setTranscricaoState] = useState('')
  const [dataSelecionada, setDataSelecionada] = useState('')
  const queryClient = useQueryClient()

  function setTranscricao(t: string) {
    transcricaoRef.current = t
    setTranscricaoState(t)
  }
  const [acao, setAcao] = useState<Acao | null>(null)
  const [ouvinDataTranscricao, setOuvinDataTranscricao] = useState('')
  const [erro, setErro] = useState('')
  const reconhecimentoRef = useRef<unknown>(null)
  const navigate = useNavigate()

  const isSupportedBrowser = Boolean(
    (window as AnyWindow).SpeechRecognition ||
      (window as AnyWindow).webkitSpeechRecognition,
  )

  const iniciarEscuta = useCallback(() => {
    const SR =
      (window as AnyWindow).SpeechRecognition ||
      (window as AnyWindow).webkitSpeechRecognition

    if (!SR) {
      setErro('Reconhecimento de voz não suportado neste dispositivo.')
      setEstado('erro')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    reconhecimentoRef.current = rec

    setTranscricao('')
    setEstado('ouvindo')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      const texto = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>)
        .map((r) => r[0].transcript)
        .join('')
      setTranscricao(texto)
    }

    rec.onerror = () => {
      setErro('Não consegui ouvir. Verifique o microfone e tente novamente.')
      setEstado('erro')
    }

    rec.onend = () => {
      // Usa a ref (não o state) para evitar closure stale
      setEstado((s) => {
        if (s === 'ouvindo') {
          if (transcricaoRef.current.trim()) {
            setTimeout(() => processarTranscricao(), 0)
          } else {
            return 'idle'
          }
        }
        return s
      })
    }

    rec.start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ouve a data por voz e interpreta com o backend
  const ouvirDataPorVoz = useCallback(() => {
    const SR = (window as AnyWindow).SpeechRecognition || (window as AnyWindow).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    setOuvinDataTranscricao('')
    setEstado('ouvindo_data')
    const textoRef = { current: '' }
    rec.onresult = (event: any) => {
      const t = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>)
        .map((r) => r[0].transcript).join('')
      textoRef.current = t
      setOuvinDataTranscricao(t)
    }
    rec.onerror = () => setEstado('pedindo_data')
    rec.onend = async () => {
      const texto = textoRef.current.trim()
      if (!texto) { setEstado('pedindo_data'); return }
      // Manda para o backend interpretar a data
      try {
        const res = await api.post<{ data_iso: string }>('/voz/interpretar-data', { texto })
        if (res.data.data_iso) {
          setDataSelecionada(res.data.data_iso)
        }
      } catch { /* ignora, usuário pode digitar */ }
      setEstado('pedindo_data')
    }
    rec.start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pararEscuta = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = reconhecimentoRef.current as any
    rec?.stop()
  }, [])

  async function processarTranscricao() {
    const texto = transcricaoRef.current || ''
    if (!texto.trim()) {
      setEstado('idle')
      return
    }
    setEstado('processando')
    try {
      const res = await withTimeout(api.post<Acao>('/voz/comando', { transcricao: texto }))
      setAcao(res.data)
      if (res.data.acao === 'nao_entendido') {
        setErro(res.data.mensagem)
        setEstado('erro')
      } else if (res.data.acao === 'pedir_data_vencimento') {
        setEstado('pedindo_data')
      } else {
        setEstado('confirmando')
      }
    } catch (e) {
      const msg = e instanceof Error && e.message.startsWith('Timeout')
        ? 'Servidor demorou demais. Verifique sua conexão e tente novamente.'
        : 'Erro ao processar. Tente novamente.'
      setErro(msg)
      setEstado('erro')
    }
  }

  async function confirmarComData() {
    if (!acao || !dataSelecionada) return
    const tipoConta = acao.dados._tipo_conta as string
    const acaoReal = tipoConta === 'receber' ? 'criar_conta_receber' : 'criar_conta_pagar'
    const rota = ROTAS[acaoReal]
    setEstado('processando')
    try {
      await withTimeout(api.post(rota, prepararDados(acaoReal, acao.dados, dataSelecionada)))
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      resetar()
      navigate(NAVEGACAO[acaoReal] || '/dashboard')
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
      setEstado('erro')
    }
  }

  async function confirmar() {
    if (!acao) return
    const rota = ROTAS[acao.acao]
    if (!rota) return

    setEstado('processando')
    try {
      if (acao.acao === 'atualizar_renda') {
        const { data: rendas } = await withTimeout(api.get<{ id: string }[]>('/rendas'))
        if (!rendas || rendas.length === 0) {
          setErro('Nenhuma renda cadastrada para atualizar. Crie uma primeiro.')
          setEstado('erro')
          return
        }
        await withTimeout(api.patch(`/rendas/${rendas[0].id}`, { valor: acao.dados.valor }))

      } else if (acao.acao === 'excluir_renda') {
        const { data: rendas } = await withTimeout(api.get<{ id: string; descricao: string; valor: number }[]>('/rendas'))
        if (!rendas || rendas.length === 0) {
          setErro('Nenhuma renda encontrada para excluir.')
          setEstado('erro')
          return
        }
        const busca = (acao.dados.descricao_busca as string || '').toLowerCase()
        const alvo = busca
          ? rendas.find((r) => r.descricao.toLowerCase().includes(busca)) ?? rendas[0]
          : rendas[0]
        await withTimeout(api.delete(`/rendas/${alvo.id}`))

      } else if (acao.acao === 'excluir_conta_pagar') {
        const { data: contas } = await withTimeout(api.get<{ id: string; descricao: string; status: string }[]>('/contas-pagar'))
        const busca = (acao.dados.descricao_busca as string || '').toLowerCase()
        const alvo = contas.find((c) =>
          c.status !== 'pago' && c.descricao.toLowerCase().includes(busca)
        ) ?? contas.find((c) => c.descricao.toLowerCase().includes(busca))
        if (!alvo) {
          setErro(`Não encontrei conta com “${acao.dados.descricao_busca}” para excluir.`)
          setEstado('erro')
          return
        }
        await withTimeout(api.delete(`/contas-pagar/${alvo.id}`))

      } else if (acao.acao === 'excluir_conta_receber') {
        const { data: contas } = await withTimeout(api.get<{ id: string; descricao: string }[]>('/contas-receber'))
        const busca = (acao.dados.descricao_busca as string || '').toLowerCase()
        const alvo = contas.find((c) => c.descricao.toLowerCase().includes(busca))
        if (!alvo) {
          setErro(`Não encontrei conta a receber com “${acao.dados.descricao_busca}” para excluir.`)
          setEstado('erro')
          return
        }
        await withTimeout(api.delete(`/contas-receber/${alvo.id}`))

      } else {
        await withTimeout(api.post(rota, prepararDados(acao.acao, acao.dados)))
      }

      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['rendas'] })
      resetar()
      navigate(NAVEGACAO[acao.acao] || '/dashboard')
    } catch (e) {
      const msg = e instanceof Error && e.message.startsWith('Timeout') 
        ? 'Servidor demorou demais. Verifique sua conexão e tente novamente.'
        : 'Erro ao executar. Tente novamente.'
      setErro(msg)
      setEstado('erro')
    }
  }
    setEstado('idle')
    setTranscricao('')
    transcricaoRef.current = ''
    setAcao(null)
    setErro('')
    setDataSelecionada('')
    setOuvinDataTranscricao('')
  }

  if (!isSupportedBrowser) return null

  return (
    <>
      {/* ── Overlay quando ativo ─────────────────────────── */}
      {estado !== 'idle' && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center pb-32"
          onClick={estado === 'ouvindo' ? undefined : resetar}
        >
          {/* Card de status */}
          <div
            className="bg-white rounded-2xl p-5 mx-4 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ouvindo */}
            {estado === 'ouvindo' && (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center animate-pulse">
                    <Mic size={28} className="text-white" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-700">Ouvindo...</p>
                {transcricao && (
                  <p className="text-sm text-gray-500 italic min-h-[40px]">"{transcricao}"</p>
                )}
                <button
                  onClick={pararEscuta}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <MicOff size={16} /> Parar e processar
                </button>
              </div>
            )}

            {/* Processando */}
            {estado === 'processando' && (
              <div className="text-center space-y-3 py-2">
                <Loader2 size={32} className="text-primary-500 animate-spin mx-auto" />
                <p className="text-sm text-gray-600">Processando comando...</p>
              </div>
            )}

            {/* Confirmando */}
            {estado === 'confirmando' && acao && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-800">{acao.mensagem}</p>
                {acao.dados.modalidade && (
                  <p className="text-xs text-primary-600 font-medium">
                    📋 {LABELS_MODALIDADE[acao.dados.modalidade as string] || String(acao.dados.modalidade)}
                  </p>
                )}
                {transcricao && (
                  <p className="text-xs text-gray-400 border-l-2 border-primary-200 pl-2 italic">
                    "{transcricao}"
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={resetar}
                    className="btn-ghost flex-1 flex items-center justify-center gap-1"
                  >
                    <X size={14} /> Cancelar
                  </button>
                  <button
                    onClick={confirmar}
                    className="btn-primary flex-1 flex items-center justify-center gap-1"
                  >
                    <Check size={14} /> Confirmar
                  </button>
                </div>
              </div>
            )}

            {/* Pedindo data de vencimento */}
            {(estado === 'pedindo_data' || estado === 'ouvindo_data') && acao && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-800">{acao.mensagem}</p>
                <p className="text-xs text-gray-500">
                  <span className="font-medium">{String(acao.dados.descricao)}</span>
                  {' · '}R$ {Number(acao.dados.valor).toFixed(2)}
                  {acao.dados.modalidade && (
                    <span className="ml-1 text-primary-600">· {LABELS_MODALIDADE[String(acao.dados.modalidade)] || String(acao.dados.modalidade)}</span>
                  )}
                </p>

                {/* Ouvindo data por voz */}
                {estado === 'ouvindo_data' ? (
                  <div className="bg-primary-50 rounded-xl p-3 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center animate-pulse mx-auto">
                      <Mic size={18} className="text-white" />
                    </div>
                    <p className="text-xs text-gray-500">Ouvindo data...</p>
                    {ouvinDataTranscricao && (
                      <p className="text-sm text-primary-700 italic">"{ouvinDataTranscricao}"</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-600">Data de vencimento</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dataSelecionada}
                        onChange={(e) => setDataSelecionada(e.target.value)}
                        className="input-field text-sm flex-1"
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <button
                        onClick={ouvirDataPorVoz}
                        className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0 hover:bg-primary-400 transition-colors"
                        title="Falar a data"
                      >
                        <Mic size={16} className="text-white" />
                      </button>
                    </div>
                    {dataSelecionada && (
                      <p className="text-xs text-primary-600 font-medium">
                        ✓ {new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={resetar} className="btn-ghost flex-1 flex items-center justify-center gap-1">
                    <X size={14} /> Cancelar
                  </button>
                  <button
                    onClick={confirmarComData}
                    disabled={!dataSelecionada || estado === 'ouvindo_data'}
                    className="btn-primary flex-1 flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Check size={14} /> Confirmar
                  </button>
                </div>
              </div>
            )}

            {/* Erro */}
            {estado === 'erro' && (
              <div className="text-center space-y-3">
                <p className="text-sm text-danger-500">{erro}</p>
                <div className="flex gap-2">
                  <button onClick={resetar} className="btn-ghost flex-1">Fechar</button>
                  <button onClick={iniciarEscuta} className="btn-primary flex-1 flex items-center justify-center gap-1">
                    <Mic size={14} /> Tentar novamente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Botão flutuante ──────────────────────────────── */}
      <button
        onClick={estado === 'idle' ? iniciarEscuta : undefined}
        className={`fixed z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          estado === 'idle'
            ? 'bg-primary-500 hover:bg-primary-400 active:scale-95'
            : 'bg-primary-400 scale-110'
        }`}
        style={{
          bottom: 'calc(env(safe-area-inset-bottom) + 80px)',
          right: '20px',
        }}
        aria-label="Assistente de voz"
      >
        <Mic size={22} className="text-white" />
      </button>
    </>
  )
}

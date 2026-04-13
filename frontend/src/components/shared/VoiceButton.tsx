/**
 * VoiceButton — Assistente de voz flutuante.
 * Usa a Web Speech API (disponível em iOS 13+ WKWebView e Android Chrome).
 */
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, X, Check, Loader2 } from 'lucide-react'
import api from '@/services/api'

type Estado = 'idle' | 'ouvindo' | 'processando' | 'confirmando' | 'pedindo_data' | 'erro'

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

// Rota para navegar após criação
const NAVEGACAO: Record<string, string> = {
  criar_conta_pagar: '/contas-pagar',
  criar_conta_receber: '/contas-receber',
  criar_renda: '/renda',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = Window & typeof globalThis & Record<string, any>

export default function VoiceButton() {
  const [estado, setEstado] = useState<Estado>('idle')
  const transcricaoRef = useRef('')
  const [transcricao, setTranscricaoState] = useState('')
  const [dataSelecionada, setDataSelecionada] = useState('')

  function setTranscricao(t: string) {
    transcricaoRef.current = t
    setTranscricaoState(t)
  }
  const [acao, setAcao] = useState<Acao | null>(null)
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
      const res = await api.post<Acao>('/voz/comando', { transcricao: texto })
      setAcao(res.data)
      if (res.data.acao === 'nao_entendido') {
        setErro(res.data.mensagem)
        setEstado('erro')
      } else if (res.data.acao === 'pedir_data_vencimento') {
        setEstado('pedindo_data')
      } else {
        setEstado('confirmando')
      }
    } catch {
      setErro('Erro ao processar. Tente novamente.')
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
      await api.post(rota, prepararDados(acaoReal, acao.dados, dataSelecionada))
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
      await api.post(rota, prepararDados(acao.acao, acao.dados))
      resetar()
      navigate(NAVEGACAO[acao.acao] || '/dashboard')
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
      setEstado('erro')
    }
  }

  function resetar() {
    setEstado('idle')
    setTranscricao('')
    transcricaoRef.current = ''
    setAcao(null)
    setErro('')
    setDataSelecionada('')
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
            {estado === 'pedindo_data' && acao && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-800">{acao.mensagem}</p>
                <p className="text-xs text-gray-500">
                  <span className="font-medium">{acao.dados.descricao as string}</span>
                  {' · '}R$ {Number(acao.dados.valor).toFixed(2)}
                  {acao.dados.modalidade && (
                    <span className="ml-1 text-primary-600">· {LABELS_MODALIDADE[acao.dados.modalidade as string] || String(acao.dados.modalidade)}</span>
                  )}
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data de vencimento</label>
                  <input
                    type="date"
                    value={dataSelecionada}
                    onChange={(e) => setDataSelecionada(e.target.value)}
                    className="input-field text-sm"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={resetar} className="btn-ghost flex-1 flex items-center justify-center gap-1">
                    <X size={14} /> Cancelar
                  </button>
                  <button
                    onClick={confirmarComData}
                    disabled={!dataSelecionada}
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

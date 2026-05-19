/**
 * useVoiceAssistant — lógica completa do assistente de voz.
 * Extraído de VoiceButton para separar estado/lógica do JSX.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

// Helper para requisições com timeout de 12s
function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: servidor demorou demais.')), ms)
    ),
  ])
}

export type EstadoVoz =
  | 'idle'
  | 'ouvindo'
  | 'processando'
  | 'confirmando'
  | 'pedindo_data'
  | 'ouvindo_data'
  | 'erro'

export interface AcaoVoz {
  acao: string
  dados: Record<string, string | number | boolean | null | undefined>
  mensagem: string
}

const ROTAS: Record<string, string> = {
  criar_conta_pagar: '/contas-pagar',
  criar_conta_receber: '/contas-receber',
  criar_renda: '/rendas',
  atualizar_renda: '/rendas',
  excluir_conta_pagar: '/contas-pagar',
  excluir_conta_receber: '/contas-receber',
  excluir_renda: '/rendas',
}

export const LABELS_MODALIDADE: Record<string, string> = {
  avulsa: 'Avulsa',
  recorrente: 'Recorrente (todo mês)',
  parcelada: 'Parcelada / Financiamento',
}

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
type AnyWindow = Window & typeof globalThis & Record<string, unknown>

interface SpeechRecognitionEvent {
  results: ArrayLike<{ 0: { transcript: string } }>
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

function criarReconhecedor(win: AnyWindow): SpeechRecognitionInstance | null {
  const SR = win.SpeechRecognition || win.webkitSpeechRecognition
  if (!SR) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec = new (SR as new () => SpeechRecognitionInstance)()
  rec.lang = 'pt-BR'
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 1
  return rec
}

export function useVoiceAssistant() {
  const [estado, setEstado] = useState<EstadoVoz>('idle')
  const transcricaoRef = useRef('')
  const [transcricao, setTranscricaoState] = useState('')
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [acao, setAcao] = useState<AcaoVoz | null>(null)
  const [ouvinDataTranscricao, setOuvinDataTranscricao] = useState('')
  const [erro, setErro] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reconhecimentoRef = useRef<SpeechRecognitionInstance | null>(null)
  const processarTranscricaoRef = useRef<() => void>(() => {})
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isSupportedBrowser = Boolean(
    (window as AnyWindow).SpeechRecognition ||
      (window as AnyWindow).webkitSpeechRecognition,
  )

  function setTranscricao(t: string) {
    transcricaoRef.current = t
    setTranscricaoState(t)
  }

  const iniciarEscuta = useCallback(() => {
    const rec = criarReconhecedor(window as AnyWindow)

    if (!rec) {
      setErro('Reconhecimento de voz não suportado neste dispositivo.')
      setEstado('erro')
      return
    }

    reconhecimentoRef.current = rec

    setTranscricao('')
    setEstado('ouvindo')

    rec.onresult = (event: SpeechRecognitionEvent) => {
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
      setEstado((s) => {
        if (s === 'ouvindo') {
          if (transcricaoRef.current.trim()) {
            setTimeout(() => processarTranscricaoRef.current(), 0)
          } else {
            return 'idle'
          }
        }
        return s
      })
    }

    rec.start()
  }, [])

  const ouvirDataPorVoz = useCallback(() => {
    const rec = criarReconhecedor(window as AnyWindow)
    if (!rec) return
    setOuvinDataTranscricao('')
    setEstado('ouvindo_data')
    const textoRef = { current: '' }
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const t = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>)
        .map((r) => r[0].transcript)
        .join('')
      textoRef.current = t
      setOuvinDataTranscricao(t)
    }
    rec.onerror = () => setEstado('pedindo_data')
    rec.onend = async () => {
      const texto = textoRef.current.trim()
      if (!texto) {
        setEstado('pedindo_data')
        return
      }
      try {
        const res = await api.post<{ data_iso: string }>('/voz/interpretar-data', { texto })
        if (res.data.data_iso) {
          setDataSelecionada(res.data.data_iso)
        }
      } catch {
        /* ignora, usuário pode digitar */
      }
      setEstado('pedindo_data')
    }
    rec.start()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pararEscuta = useCallback(() => {
    reconhecimentoRef.current?.stop()
  }, [])

  async function processarTranscricao() {
    const texto = transcricaoRef.current || ''
    if (!texto.trim()) {
      setEstado('idle')
      return
    }
    setEstado('processando')
    try {
      const res = await withTimeout(api.post<AcaoVoz>('/voz/comando', { transcricao: texto }))
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
      const msg =
        e instanceof Error && e.message.startsWith('Timeout')
          ? 'Servidor demorou demais. Verifique sua conexão e tente novamente.'
          : 'Erro ao processar. Tente novamente.'
      setErro(msg)
      setEstado('erro')
    }
  }

  useEffect(() => {
    processarTranscricaoRef.current = processarTranscricao
  })

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

  type DadosAcao = AcaoVoz['dados']

  const ACTION_HANDLERS: Partial<Record<string, (dados: DadosAcao) => Promise<void>>> = {
    atualizar_renda: async (dados) => {
      const { data: rendas } = await withTimeout(api.get<{ id: string }[]>('/rendas'))
      if (!rendas || rendas.length === 0) {
        setErro('Nenhuma renda cadastrada para atualizar. Crie uma primeiro.')
        setEstado('erro')
        return
      }
      await withTimeout(api.patch(`/rendas/${rendas[0].id}`, { valor: dados.valor }))
    },
    excluir_renda: async (dados) => {
      const { data: rendas } = await withTimeout(
        api.get<{ id: string; descricao: string; valor: number }[]>('/rendas')
      )
      if (!rendas || rendas.length === 0) {
        setErro('Nenhuma renda encontrada para excluir.')
        setEstado('erro')
        return
      }
      const busca = ((dados.descricao_busca as string) || '').toLowerCase()
      const alvo = busca
        ? rendas.find((r) => r.descricao.toLowerCase().includes(busca)) ?? rendas[0]
        : rendas[0]
      await withTimeout(api.delete(`/rendas/${alvo.id}`))
    },
    excluir_conta_pagar: async (dados) => {
      const { data: contas } = await withTimeout(
        api.get<{ id: string; descricao: string; status: string }[]>('/contas-pagar')
      )
      const busca = ((dados.descricao_busca as string) || '').toLowerCase()
      const alvo =
        contas.find((c) => c.status !== 'pago' && c.descricao.toLowerCase().includes(busca)) ??
        contas.find((c) => c.descricao.toLowerCase().includes(busca))
      if (!alvo) {
        setErro(`Não encontrei conta com "${dados.descricao_busca}" para excluir.`)
        setEstado('erro')
        return
      }
      await withTimeout(api.delete(`/contas-pagar/${alvo.id}`))
    },
    excluir_conta_receber: async (dados) => {
      const { data: contas } = await withTimeout(
        api.get<{ id: string; descricao: string }[]>('/contas-receber')
      )
      const busca = ((dados.descricao_busca as string) || '').toLowerCase()
      const alvo = contas.find((c) => c.descricao.toLowerCase().includes(busca))
      if (!alvo) {
        setErro(`Não encontrei conta a receber com "${dados.descricao_busca}" para excluir.`)
        setEstado('erro')
        return
      }
      await withTimeout(api.delete(`/contas-receber/${alvo.id}`))
    },
  }

  async function confirmar() {
    if (!acao) return
    const rota = ROTAS[acao.acao]
    if (!rota) return

    setEstado('processando')
    try {
      const handler = ACTION_HANDLERS[acao.acao]
      if (handler) {
        await handler(acao.dados)
        if (estado === 'erro') return
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
      const msg =
        e instanceof Error && e.message.startsWith('Timeout')
          ? 'Servidor demorou demais. Verifique sua conexão e tente novamente.'
          : 'Erro ao executar. Tente novamente.'
      setErro(msg)
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
    setOuvinDataTranscricao('')
  }

  return {
    estado,
    acao,
    transcricao,
    dataSelecionada,
    setDataSelecionada,
    ouvinDataTranscricao,
    erro,
    isSupportedBrowser,
    iniciarEscuta,
    ouvirDataPorVoz,
    pararEscuta,
    confirmar,
    confirmarComData,
    resetar,
  }
}

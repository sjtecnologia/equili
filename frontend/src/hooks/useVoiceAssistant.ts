/**
 * useVoiceAssistant — lógica completa do assistente de voz.
 * Extraído de VoiceButton para separar estado/lógica do JSX.
 */
import { useReducer, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import { invalidateFinanceiroBase } from '@/lib/queryInvalidation'

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

interface VoiceAssistantState {
  estado: EstadoVoz
  transcricao: string
  dataSelecionada: string
  acao: AcaoVoz | null
  ouvinDataTranscricao: string
  erro: string
}

type VoiceAssistantAction =
  | { type: 'SET_ESTADO'; value: EstadoVoz }
  | { type: 'SET_TRANSCRICAO'; value: string }
  | { type: 'SET_DATA_SELECIONADA'; value: string }
  | { type: 'SET_ACAO'; value: AcaoVoz | null }
  | { type: 'SET_OUVIN_DATA_TRANSCRICAO'; value: string }
  | { type: 'SET_ERRO'; value: string }
  | { type: 'RESET' }

const initialState: VoiceAssistantState = {
  estado: 'idle',
  transcricao: '',
  dataSelecionada: '',
  acao: null,
  ouvinDataTranscricao: '',
  erro: '',
}

function voiceAssistantReducer(
  state: VoiceAssistantState,
  action: VoiceAssistantAction
): VoiceAssistantState {
  switch (action.type) {
    case 'SET_ESTADO':
      return { ...state, estado: action.value }
    case 'SET_TRANSCRICAO':
      return { ...state, transcricao: action.value }
    case 'SET_DATA_SELECIONADA':
      return { ...state, dataSelecionada: action.value }
    case 'SET_ACAO':
      return { ...state, acao: action.value }
    case 'SET_OUVIN_DATA_TRANSCRICAO':
      return { ...state, ouvinDataTranscricao: action.value }
    case 'SET_ERRO':
      return { ...state, erro: action.value }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

const ROTAS: Record<string, string> = {
  criar_conta_pagar: '/contas-pagar',
  criar_conta_receber: '/contas-receber',
  criar_renda: '/rendas',
  atualizar_renda: '/rendas',
  excluir_conta_pagar: '/contas-pagar',
  excluir_conta_receber: '/contas-receber',
  excluir_renda: '/rendas',
  criar_divida: '/dividas',
  registrar_pagamento_divida: '/dividas',
  excluir_divida: '/dividas',
  criar_investimento: '/investimentos',
  atualizar_investimento: '/investimentos',
  excluir_investimento: '/investimentos',
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
  if (acao === 'criar_divida') {
    return {
      descricao: dados.descricao,
      valor_total: dados.valor_total,
      valor_parcela: dados.valor_parcela,
      parcelas_restantes: dados.parcelas_restantes || 1,
      tipo: dados.tipo || 'emprestimo',
      credor: dados.credor || '',
      data_primeira_parcela: dataExtra || dados.data_primeira_parcela,
    }
  }
  if (acao === 'criar_investimento') {
    return {
      nome: dados.nome,
      tipo: dados.tipo || 'acoes',
      valor_investido: dados.valor_investido,
      data_investimento: dataExtra || dados.data_investimento,
    }
  }
  return dados
}

const NAVEGACAO: Record<string, string> = {
  criar_conta_pagar: '/contas-pagar',
  criar_conta_receber: '/contas-receber',
  criar_renda: '/rendas',
  atualizar_renda: '/rendas',
  excluir_conta_pagar: '/contas-pagar',
  excluir_conta_receber: '/contas-receber',
  excluir_renda: '/rendas',
  criar_divida: '/dividas',
  registrar_pagamento_divida: '/dividas',
  excluir_divida: '/dividas',
  criar_investimento: '/investimentos',
  atualizar_investimento: '/investimentos',
  excluir_investimento: '/investimentos',
}

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
  const rec = new (SR as new () => SpeechRecognitionInstance)()
  rec.lang = 'pt-BR'
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 1
  return rec
}

export function useVoiceAssistant() {
  const [state, dispatch] = useReducer(voiceAssistantReducer, initialState)
  const estadoRef = useRef<EstadoVoz>(initialState.estado)
  const transcricaoRef = useRef('')
  const reconhecimentoRef = useRef<SpeechRecognitionInstance | null>(null)
  const processarTranscricaoRef = useRef<() => void>(() => {})
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isSupportedBrowser = Boolean(
    (window as AnyWindow).SpeechRecognition ||
      (window as AnyWindow).webkitSpeechRecognition,
  )

  const setEstado = useCallback((value: EstadoVoz) => {
    dispatch({ type: 'SET_ESTADO', value })
  }, [])

  const setErro = useCallback((value: string) => {
    dispatch({ type: 'SET_ERRO', value })
  }, [])

  const setDataSelecionada = useCallback((value: string) => {
    dispatch({ type: 'SET_DATA_SELECIONADA', value })
  }, [])

  useEffect(() => {
    estadoRef.current = state.estado
  }, [state.estado])

  function setTranscricao(t: string) {
    transcricaoRef.current = t
    dispatch({ type: 'SET_TRANSCRICAO', value: t })
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
      if (estadoRef.current === 'ouvindo') {
        if (transcricaoRef.current.trim()) {
          setTimeout(() => processarTranscricaoRef.current(), 0)
        } else {
          setEstado('idle')
        }
      }
    }

    rec.start()
  }, [])

  const ouvirDataPorVoz = useCallback(() => {
    const rec = criarReconhecedor(window as AnyWindow)
    if (!rec) return
    dispatch({ type: 'SET_OUVIN_DATA_TRANSCRICAO', value: '' })
    setEstado('ouvindo_data')
    const textoRef = { current: '' }
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const t = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>)
        .map((r) => r[0].transcript)
        .join('')
      textoRef.current = t
      dispatch({ type: 'SET_OUVIN_DATA_TRANSCRICAO', value: t })
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
  }, [])

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
      dispatch({ type: 'SET_ACAO', value: res.data })
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
    if (!state.acao || !state.dataSelecionada) return
    const tipoConta = state.acao.dados._tipo_conta as string
    let acaoReal = ''
    
    if (tipoConta === 'receber') {
      acaoReal = 'criar_conta_receber'
    } else if (tipoConta === 'pagar') {
      acaoReal = 'criar_conta_pagar'
    } else if (tipoConta === 'divida') {
      acaoReal = 'criar_divida'
    } else if (tipoConta === 'pagamento_divida') {
      acaoReal = 'registrar_pagamento_divida'
    } else {
      acaoReal = 'criar_conta_pagar'
    }
    
    const rota = ROTAS[acaoReal]
    setEstado('processando')
    try {
      await withTimeout(api.post(rota, prepararDados(acaoReal, state.acao.dados, state.dataSelecionada)))
      invalidateFinanceiroBase(queryClient)
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
        throw new Error('Nenhuma renda cadastrada para atualizar. Crie uma primeiro.')
      }
      await withTimeout(api.patch(`/rendas/${rendas[0].id}`, { valor: dados.valor }))
    },
    excluir_renda: async (dados) => {
      const { data: rendas } = await withTimeout(
        api.get<{ id: string; descricao: string; valor: number }[]>('/rendas')
      )
      if (!rendas || rendas.length === 0) {
        throw new Error('Nenhuma renda encontrada para excluir.')
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
        throw new Error(`Não encontrei conta com "${dados.descricao_busca}" para excluir.`)
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
        throw new Error(`Não encontrei conta a receber com "${dados.descricao_busca}" para excluir.`)
      }
      await withTimeout(api.delete(`/contas-receber/${alvo.id}`))
    },
    excluir_divida: async (dados) => {
      const { data: dividas } = await withTimeout(
        api.get<{ id: string; descricao: string }[]>('/dividas')
      )
      const busca = ((dados.descricao_busca as string) || '').toLowerCase()
      const alvo = dividas.find((d) => d.descricao.toLowerCase().includes(busca))
      if (!alvo) {
        throw new Error(`Não encontrei dívida com "${dados.descricao_busca}" para excluir.`)
      }
      await withTimeout(api.delete(`/dividas/${alvo.id}`))
    },
    registrar_pagamento_divida: async (dados) => {
      const { data: dividas } = await withTimeout(
        api.get<{ id: string; descricao: string }[]>('/dividas')
      )
      const busca = ((dados.descricao_busca as string) || '').toLowerCase()
      const alvo = dividas.find((d) => d.descricao.toLowerCase().includes(busca))
      if (!alvo) {
        throw new Error(`Não encontrei dívida com "${dados.descricao_busca}" para registrar pagamento.`)
      }
      await withTimeout(api.post(`/dividas/${alvo.id}/pagar-parcela`, {
        valor_pago: dados.valor_pago,
        data_pagamento: dados.data_pagamento,
      }))
    },
    atualizar_investimento: async (dados) => {
      const { data: investimentos } = await withTimeout(
        api.get<{ id: string; nome: string }[]>('/investimentos')
      )
      const busca = ((dados.nome_busca as string) || '').toLowerCase()
      const alvo = investimentos.find((i) => i.nome.toLowerCase().includes(busca))
      if (!alvo) {
        throw new Error(`Não encontrei investimento com "${dados.nome_busca}" para atualizar.`)
      }
      await withTimeout(api.patch(`/investimentos/${alvo.id}`, { valor_atual: dados.valor_atual }))
    },
    excluir_investimento: async (dados) => {
      const { data: investimentos } = await withTimeout(
        api.get<{ id: string; nome: string }[]>('/investimentos')
      )
      const busca = ((dados.nome_busca as string) || '').toLowerCase()
      const alvo = investimentos.find((i) => i.nome.toLowerCase().includes(busca))
      if (!alvo) {
        throw new Error(`Não encontrei investimento com "${dados.nome_busca}" para excluir.`)
      }
      await withTimeout(api.delete(`/investimentos/${alvo.id}`))
    },
    navegar: async (dados) => {
      const destino = dados.destino as string
      resetar()
      navigate(destino || '/dashboard')
    },
  }

  async function confirmar() {
    if (!state.acao) return
    
    // Ações que não precisam de rota (como navegação)
    if (state.acao.acao === 'navegar') {
      const handler = ACTION_HANDLERS[state.acao.acao]
      setEstado('processando')
      try {
        if (handler) {
          await handler(state.acao.dados)
        }
      } catch (e) {
        const msg =
          e instanceof Error && e.message.startsWith('Timeout')
            ? 'Servidor demorou demais. Verifique sua conexão e tente novamente.'
            : e instanceof Error && e.message
            ? e.message
            : 'Erro ao executar. Tente novamente.'
        setErro(msg)
        setEstado('erro')
      }
      return
    }
    
    const rota = ROTAS[state.acao.acao]
    if (!rota) return

    setEstado('processando')
    try {
      const handler = ACTION_HANDLERS[state.acao.acao]
      if (handler) {
        await handler(state.acao.dados)
      } else {
        await withTimeout(api.post(rota, prepararDados(state.acao.acao, state.acao.dados)))
      }

      invalidateFinanceiroBase(queryClient, true)
      resetar()
      navigate(NAVEGACAO[state.acao.acao] || '/dashboard')
    } catch (e) {
      const msg =
        e instanceof Error && e.message.startsWith('Timeout')
          ? 'Servidor demorou demais. Verifique sua conexão e tente novamente.'
          : e instanceof Error && e.message
          ? e.message
          : 'Erro ao executar. Tente novamente.'
      setErro(msg)
      setEstado('erro')
    }
  }

  function resetar() {
    transcricaoRef.current = ''
    dispatch({ type: 'RESET' })
  }

  return {
    estado: state.estado,
    acao: state.acao,
    transcricao: state.transcricao,
    dataSelecionada: state.dataSelecionada,
    setDataSelecionada,
    ouvinDataTranscricao: state.ouvinDataTranscricao,
    erro: state.erro,
    isSupportedBrowser,
    iniciarEscuta,
    ouvirDataPorVoz,
    pararEscuta,
    confirmar,
    confirmarComData,
    resetar,
  }
}

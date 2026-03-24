import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Lightbulb, Loader2, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import api from '@/services/api'


interface OrdemQuitacao {
  ordem: number
  descricao: string
  data_quitacao_estimada: string
  motivo_prioridade: string
}

interface PlanoConteudo {
  resumo_situacao: string
  estrategia: string
  justificativa_estrategia?: string
  valor_mensal_para_dividas?: number
  ordem_quitacao: OrdemQuitacao[]
  data_livre_prevista: string
  meses_ate_liberdade?: number
  sugestoes_economia: string[]
  mensagem_motivacional: string
}

interface PlanoAcao {
  id: string
  criado_em: string
  conteudo: PlanoConteudo
  estrategia: string | null
  data_livre_prevista: string | null
  feedback: number | null  // 1 | -1
}

const mensagensCarregando = [
  'Analisando sua situação financeira...',
  'Calculando a melhor estratégia...',
  'Identificando oportunidades de economia...',
  'Montando seu plano personalizado...',
  'Quase pronto! Você vai conseguir! 💚',
]

function LoadingState() {
  const [idx] = useState(() => Math.floor(Math.random() * mensagensCarregando.length))
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
          <Sparkles size={28} className="text-primary-500 animate-pulse" />
        </div>
      </div>
      <p className="text-sm text-gray-600 text-center max-w-xs animate-pulse">
        {mensagensCarregando[idx]}
      </p>
    </div>
  )
}

export default function PlanoAcaoPage() {
  const queryClient = useQueryClient()
  const [isGenerating, setIsGenerating] = useState(false)
  const [limitError, setLimitError] = useState(false)

  const { data: plano, isLoading } = useQuery<PlanoAcao | null>({
    queryKey: ['plano-atual'],
    queryFn: () =>
      api
        .get('/plano-acao/atual')
        .then((r) => r.data)
        .catch(() => null),
  })

  const gerarMutation = useMutation({
    mutationFn: () => api.post('/plano-acao/gerar'),
    onMutate: () => setIsGenerating(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plano-atual'] })
      setIsGenerating(false)
    },
    onError: (err: { response?: { status: number } }) => {
      setIsGenerating(false)
      if (err.response?.status === 403) setLimitError(true)
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) =>
      api.post(`/plano-acao/${id}/feedback`, { feedback: valor }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plano-atual'] }),
  })

  if (isLoading) return <LoadingState />
  if (isGenerating) return <LoadingState />

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Plano de Ação IA</h1>
          <p className="text-sm text-gray-500">Estratégia personalizada para você</p>
        </div>
        {plano && (
          <button
            onClick={() => gerarMutation.mutate()}
            disabled={gerarMutation.isPending}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} />
            Regenerar
          </button>
        )}
      </div>

      {limitError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-gray-700">
          Você atingiu o limite de geração de planos no plano gratuito este mês.{' '}
          <a href="#" className="text-primary-500 font-medium hover:underline">
            Fazer upgrade
          </a>
        </div>
      )}

      {!plano ? (
        <div className="card p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
            <Sparkles size={28} className="text-primary-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Nenhum plano gerado ainda</p>
            <p className="text-sm text-gray-500 mt-1">
              Nossa IA vai analisar sua renda e dívidas para criar um plano personalizado
              de quitação.
            </p>
          </div>
          <button
            onClick={() => gerarMutation.mutate()}
            disabled={gerarMutation.isPending || limitError}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            {gerarMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Gerar meu plano
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Data de liberdade — destaque */}
          {plano.data_livre_prevista && (
            <div className="card bg-primary-500 text-white p-5 text-center">
              <Calendar size={24} className="mx-auto mb-2 opacity-80" />
              <p className="text-sm opacity-80">Previsão de liberdade financeira</p>
              <p className="text-3xl font-extrabold mt-1">{plano.data_livre_prevista}</p>
            </div>
          )}

          {/* Mensagem motivacional */}
          {plano.conteudo?.mensagem_motivacional && (
            <div className="card bg-primary-50 border border-primary-100 p-4 flex gap-3">
              <Sparkles size={18} className="text-primary-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 italic">"{plano.conteudo.mensagem_motivacional}"</p>
            </div>
          )}

          {/* Resumo da situação */}
          {plano.conteudo?.resumo_situacao && (
            <div className="card p-4 space-y-1">
              <h2 className="font-semibold text-gray-800 text-sm">Análise da situação</h2>
              <p className="text-sm text-gray-600">{plano.conteudo.resumo_situacao}</p>
            </div>
          )}

          {/* Estratégia */}
          {plano.conteudo?.estrategia && (
            <div className="card p-4 space-y-1">
              <h2 className="font-semibold text-gray-800 text-sm">Estratégia recomendada</h2>
              <p className="text-sm text-gray-600 capitalize">{plano.conteudo.estrategia}</p>
              {plano.conteudo.justificativa_estrategia && (
                <p className="text-xs text-gray-500 mt-1">{plano.conteudo.justificativa_estrategia}</p>
              )}
            </div>
          )}

          {/* Ordem de quitação */}
          {plano.conteudo?.ordem_quitacao?.length > 0 && (
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-gray-800 text-sm">Ordem de quitação</h2>
              <ol className="space-y-2">
                {plano.conteudo.ordem_quitacao.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-500 text-xs font-bold flex items-center justify-center">
                      {item.ordem}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{item.descricao}</p>
                      <p className="text-xs text-gray-500">
                        Previsão: {item.data_quitacao_estimada} · {item.motivo_prioridade}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Sugestões de economia */}
          {plano.conteudo?.sugestoes_economia?.length > 0 && (
            <div className="card p-4 space-y-2">
              <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <Lightbulb size={14} className="text-accent-500" />
                Sugestões de economia
              </h2>
              <ul className="space-y-1.5">
                {plano.conteudo.sugestoes_economia.map((s, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-accent-500 shrink-0">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Feedback */}
          {plano.feedback === null ? (
            <div className="card p-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">Este plano foi útil para você?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => feedbackMutation.mutate({ id: plano.id, valor: 1 })}
                  disabled={feedbackMutation.isPending}
                  className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-success-500 transition-colors"
                  aria-label="Gostei"
                >
                  <ThumbsUp size={18} />
                </button>
                <button
                  onClick={() => feedbackMutation.mutate({ id: plano.id, valor: -1 })}
                  disabled={feedbackMutation.isPending}
                  className="p-2 rounded-lg hover:bg-danger-100 text-gray-400 hover:text-danger-500 transition-colors"
                  aria-label="Não gostei"
                >
                  <ThumbsDown size={18} />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-gray-400">
              Obrigado pelo seu feedback! {plano.feedback === 1 ? '😊' : '🙏'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

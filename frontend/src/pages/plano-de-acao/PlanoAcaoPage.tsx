import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Calendar, Lightbulb, Loader2, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { usePlanoAcao } from '@/hooks/usePlanoAcao'

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
  const {
    plano,
    isLoading,
    limitError,
    erroGerar,
    contasPagar,
    contasReceber,
    gerar,
    isGerando,
    darFeedback,
  } = usePlanoAcao()

  if (isLoading) return <LoadingState />
  if (isGerando) return <LoadingState />

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Plano de Ação IA</h1>
          <p className="text-sm text-gray-500">Estratégia personalizada para você</p>
        </div>
        {plano && (
          <button
            onClick={gerar}
            disabled={isGerando}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} />
            Regenerar
          </button>
        )}
      </div>

      {limitError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-gray-700">
          Você atingiu o limite de geração de planos este mês.{' '}
          <Link to="/planos" className="text-primary-500 font-medium hover:underline">
            Fazer upgrade
          </Link>{' '}
          para gerar sem limite.
        </div>
      )}

      {erroGerar && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {erroGerar}
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
            onClick={gerar}
            disabled={isGerando || limitError}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            {isGerando ? (
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

          {/* Alerta de fluxo de caixa */}
          {plano.conteudo?.alerta_fluxo_caixa && (
            <div className="card border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">{plano.conteudo.alerta_fluxo_caixa}</p>
            </div>
          )}

          {/* Resumo contas a pagar/receber */}
          {((contasPagar?.length ?? 0) > 0 || (contasReceber?.length ?? 0) > 0) && (
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-gray-800 text-sm">Movimentação pendente</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-danger-50 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowDownCircle size={14} className="text-danger-500" />
                    <span className="text-xs font-medium text-danger-600">A pagar</span>
                  </div>
                  <p className="text-base font-bold text-danger-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      (contasPagar ?? []).reduce((s, c) => s + Number(c.valor), 0)
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{contasPagar?.length ?? 0} conta(s)</p>
                </div>
                <div className="rounded-xl bg-success-50 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUpCircle size={14} className="text-success-500" />
                    <span className="text-xs font-medium text-success-600">A receber</span>
                  </div>
                  <p className="text-base font-bold text-success-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      (contasReceber ?? []).reduce((s, c) => s + Number(c.valor), 0)
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{contasReceber?.length ?? 0} conta(s)</p>
                </div>
              </div>
              {/* Próximas a vencer */}
              {(contasPagar?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Próximas a vencer</p>
                  {contasPagar!.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1 mr-2">{c.descricao}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {c.data_vencimento.split('-').reverse().join('/')}
                      </span>
                      <span className="text-sm font-medium text-danger-500 ml-3 shrink-0">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.valor))}
                      </span>
                    </div>
                  ))}
                  {(contasPagar?.length ?? 0) > 5 && (
                    <p className="text-xs text-gray-400">+ {(contasPagar?.length ?? 0) - 5} outras contas a pagar</p>
                  )}
                </div>
              )}
              {/* Próximos a receber */}
              {(contasReceber?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Próximos a receber</p>
                  {contasReceber!.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1 mr-2">{c.descricao}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {c.data_prevista.split('-').reverse().join('/')}
                      </span>
                      <span className="text-sm font-medium text-success-500 ml-3 shrink-0">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.valor))}
                      </span>
                    </div>
                  ))}
                  {(contasReceber?.length ?? 0) > 5 && (
                    <p className="text-xs text-gray-400">+ {(contasReceber?.length ?? 0) - 5} outras contas a receber</p>
                  )}
                </div>
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
                  onClick={() => darFeedback({ id: plano.id, valor: 1 })}
                  className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-success-500 transition-colors"
                  aria-label="Gostei"
                >
                  <ThumbsUp size={18} />
                </button>
                <button
                  onClick={() => darFeedback({ id: plano.id, valor: -1 })}
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

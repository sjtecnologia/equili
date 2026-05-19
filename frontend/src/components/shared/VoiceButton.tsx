/**
 * VoiceButton — Assistente de voz flutuante.
 * Usa a Web Speech API (disponível em iOS 13+ WKWebView e Android Chrome).
 */
import { Mic, MicOff, X, Check, Loader2 } from 'lucide-react'
import { useVoiceAssistant, LABELS_MODALIDADE } from '@/hooks/useVoiceAssistant'

export default function VoiceButton() {
  const {
    estado, acao, transcricao, dataSelecionada, setDataSelecionada,
    ouvinDataTranscricao, erro, isSupportedBrowser,
    iniciarEscuta, ouvirDataPorVoz, pararEscuta, confirmar, confirmarComData, resetar,
  } = useVoiceAssistant()

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

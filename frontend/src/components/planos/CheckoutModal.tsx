import { useState } from 'react'
import { Check, CheckCircle2, Copy, Crown, ExternalLink, Loader2, QrCode, RefreshCw, Wallet, X } from 'lucide-react'
import { criarAssinaturaCheckout, simularPagamentoAprovado } from '@/services/api'
import type { CheckoutResponse, PlanoEntitlements } from '@/types/financeiro'

type Metodo = 'pix' | 'cartao'

interface Props {
  plano: PlanoEntitlements
  onClose: () => void
  /** Chamado quando a assinatura é confirmada (para o pai refrescar planos). */
  onAtivado: () => void
}

function brl(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function copiar(texto: string): Promise<void> {
  return navigator.clipboard.writeText(texto)
}

export default function CheckoutModal({ plano, onClose, onAtivado }: Props) {
  const [metodo, setMetodo] = useState<Metodo>('pix')
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [simulando, setSimulando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function iniciarCheckout() {
    setEnviando(true)
    setErro(null)
    try {
      const resultado = await criarAssinaturaCheckout(plano.nome, metodo)
      setCheckout(resultado)
    } catch (e: unknown) {
      let msg = 'Não foi possível iniciar o pagamento. Tente novamente.'
      if (e && typeof e === 'object' && 'response' in e) {
        const detail = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        if (detail) msg = detail
      }
      setErro(msg)
    } finally {
      setEnviando(false)
    }
  }

  async function simular() {
    if (!checkout?.pagamento.gateway_pagamento_id) return
    setSimulando(true)
    setErro(null)
    try {
      await simularPagamentoAprovado(checkout.pagamento.gateway_pagamento_id)
      setSucesso(true)
      setTimeout(() => {
        onAtivado()
        onClose()
      }, 1800)
    } catch {
      setErro('Não foi possível simular a aprovação. Verifique se o ambiente de teste está ativo (PAYMENT_GATEWAY=mock).')
      setSimulando(false)
    }
  }

  function voltar() {
    setCheckout(null)
    setSucesso(false)
    setErro(null)
  }

  const pagamento = checkout?.pagamento
  const expiraLabel = pagamento?.expira_em
    ? new Date(pagamento.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Crown size={20} className="text-primary-500" />
            <div>
              <h2 className="text-base font-bold text-gray-800">Assinar {plano.rotulo}</h2>
              <p className="text-xs text-gray-500">{brl(plano.preco_mensal)}/mês · cancelamento quando quiser</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {sucesso ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 size={44} className="text-green-500" />
            <p className="font-semibold text-gray-800">{plano.rotulo} ativado!</p>
            <p className="text-sm text-gray-500">Seus recursos já estão liberados.</p>
          </div>
        ) : !checkout ? (
          /* ── Etapa 1: escolher método ── */
          <>
            <p className="text-sm text-gray-600">Como você quer pagar?</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { valor: 'pix' as Metodo, rotulo: 'PIX', desc: 'QR code para pagar na hora', Icone: QrCode },
                  { valor: 'cartao' as Metodo, rotulo: 'Cartão', desc: 'Débito/crédito bancário', Icone: Wallet },
                ]
              ).map(({ valor, rotulo, desc, Icone }) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setMetodo(valor)}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    metodo === valor ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icone size={20} className={metodo === valor ? 'text-primary-500' : 'text-gray-400'} />
                  <p className="mt-2 font-semibold text-sm text-gray-800">{rotulo}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </button>
              ))}
            </div>
            <button onClick={iniciarCheckout} disabled={enviando} className="btn-primary w-full flex items-center justify-center gap-2">
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
              Continuar para o pagamento
            </button>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </>
        ) : (
          /* ── Etapa 2: pagamento ── */
          <>
            {pagamento?.metodo === 'pix' ? (
              <div className="space-y-3">
                <div className="flex justify-center">
                  {pagamento.qr_base64 ? (
                    <img src={pagamento.qr_base64} alt="QR Code PIX" className="w-44 h-44 rounded-xl border border-gray-200" />
                  ) : (
                    <div className="w-44 h-44 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400">
                      <QrCode size={40} />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Pague o PIX abaixo no seu banco. Tratamento instantâneo na confirmação
                  {expiraLabel && ` — código válido até ${expiraLabel}`}.
                </p>
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">PIX copia e cola</p>
                  <p className="font-mono text-xs text-gray-700 break-all max-h-16 overflow-y-auto leading-relaxed">
                    {pagamento.qr_code ?? '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => pagamento.qr_code && copiar(pagamento.qr_code).then(() => setCopiado(true))}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {copiado ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                  {copiado ? 'Código copiado!' : 'Copiar código PIX'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center">
                  <Wallet size={28} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-700">Você será redirecionado para a página de pagamento com cartão.</p>
                </div>
                {pagamento?.url_pagamento && (
                  <a
                    href={pagamento.url_pagamento}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Abrir página de pagamento
                  </a>
                )}
              </div>
            )}

            {checkout.simulavel && (
              <div className="rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 p-3">
                <p className="text-xs font-medium text-primary-700 mb-2">
                  🧪 Ambiente de teste — sem gateway real configurado. Para validar o fluxo:
                </p>
                <button
                  type="button"
                  onClick={simular}
                  disabled={simulando}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-500 text-white py-2.5 text-sm hover:bg-primary-600 disabled:opacity-50"
                >
                  {simulando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  {simulando ? 'Confirmando…' : 'Simular pagamento aprovado'}
                </button>
              </div>
            )}

            {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{erro}</p>}

            <button onClick={voltar} className="w-full text-sm text-gray-500 hover:text-gray-700">
              Trocar o método de pagamento
            </button>
          </>
        )}
      </div>
    </div>
  )
}
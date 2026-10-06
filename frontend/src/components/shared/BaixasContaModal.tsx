import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Undo2, CheckCircle2 } from 'lucide-react'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { useContas } from '@/hooks/useContas'
import { invalidateContasPagarAndDashboard, invalidateContasReceberAndDashboard, invalidateSaldos } from '@/lib/queryInvalidation'
import api from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import { parseApiError } from '@/utils/api'
import { notify } from '@/utils/notify'
import type { ContaAPagar, ContaAReceber } from '@/types/financeiro'

interface BaixaConta {
  id: string
  valor: number
  data: string
  meio: 'dinheiro' | 'conta' | 'cartao'
  conta_id: string | null
  cartao_id: string | null
  cancelada_em: string | null
}

export function BaixasContaModal({ conta, receber = false, onClose }: {
  conta: ContaAPagar | ContaAReceber
  receber?: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { contas, cartoes } = useContas()
  const base = `/contas-${receber ? 'receber' : 'pagar'}/${conta.id}/baixas`
  const [editando, setEditando] = useState<BaixaConta | null>(null)
  const [valor, setValor] = useState(Math.max(0, Number(conta.valor) - Number(conta.valor_baixado)))
  const [data, setData] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
  })
  const [meio, setMeio] = useState<BaixaConta['meio']>('dinheiro')
  const [destino, setDestino] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const { data: baixas = [], isLoading, isError } = useQuery<BaixaConta[]>({
    queryKey: ['baixas-contas', receber, conta.id],
    queryFn: () => api.get(base).then(r => r.data),
  })
  const baixado = baixas.filter(b => !b.cancelada_em).reduce((s, b) => s + Number(b.valor), 0)
  const restante = Math.max(0, Number(conta.valor) - baixado)
  const maximo = restante + Number(editando?.valor ?? 0)

  async function atualizar() {
    await Promise.all([
      receber ? invalidateContasReceberAndDashboard(qc) : invalidateContasPagarAndDashboard(qc),
      invalidateSaldos(qc),
    ])
  }

  function editar(baixa: BaixaConta) {
    setEditando(baixa)
    setValor(Number(baixa.valor))
    setData(baixa.data)
    setMeio(baixa.meio)
    setDestino(baixa.conta_id ?? baixa.cartao_id ?? '')
    setErro('')
  }

  async function cancelar(baixa: BaixaConta) {
    if (!window.confirm(`Cancelar a baixa de ${formatCurrency(Number(baixa.valor))}?`)) return
    setOcupado(true)
    setErro('')
    try {
      await api.delete(`${base}/${baixa.id}`)
      setEditando(null)
      await atualizar()
      setValor(restante + Number(baixa.valor))
      notify.success('Baixa cancelada.')
    } catch (e) { setErro(parseApiError(e)) }
    finally { setOcupado(false) }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (valor <= 0 || valor > Math.round(maximo * 100) / 100) {
      setErro('Informe um valor positivo que não supere o saldo restante.')
      return
    }
    if (meio !== 'dinheiro' && !destino) { setErro('Selecione a conta ou o cartão.'); return }
    setOcupado(true)
    setErro('')
    try {
      const payload = { valor, data, meio, conta_id: meio === 'conta' ? destino : null, cartao_id: meio === 'cartao' ? destino : null }
      if (editando) await api.patch(`${base}/${editando.id}`, payload)
      else await api.post(base, payload)
      await atualizar()
      notify.success(editando ? 'Baixa corrigida.' : 'Baixa registrada.')
      onClose()
    } catch (e) { setErro(parseApiError(e)) }
    finally { setOcupado(false) }
  }

  return <ModalDialog title="Baixas da parcela" onClose={() => !ocupado && onClose()} scrollable>
    <div className="p-4 space-y-4">
      <p className="font-medium break-words">{conta.descricao}</p>
      {isLoading ? <Loader2 className="animate-spin" aria-label="Carregando baixas" /> : isError ?
        <p role="alert" className="text-red-600">Não foi possível carregar as baixas.</p> : <>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p>Baixado: <strong>{formatCurrency(baixado)}</strong></p>
          <p>Restante: <strong>{formatCurrency(restante)}</strong></p>
        </div>
        {baixas.length > 0 && <div className="divide-y border-y">
          {baixas.map(b => <div key={b.id} className={`py-3 flex items-center gap-2 ${b.cancelada_em ? 'text-gray-400' : ''}`}>
            <div className="flex-1 min-w-0 text-sm">
              <p>{formatCurrency(Number(b.valor))} · {formatDate(b.data)}</p>
              <p className="text-xs break-words">{b.cancelada_em ? 'Cancelada · ' : ''}{
                b.conta_id ? contas.find(c => c.id === b.conta_id)?.nome ?? 'Conta bancária' :
                b.cartao_id ? cartoes.find(c => c.id === b.cartao_id)?.nome ?? 'Cartão' : 'Dinheiro'
              }</p>
            </div>
            {!b.cancelada_em && <>
              <button type="button" title="Corrigir baixa" aria-label="Corrigir baixa" disabled={ocupado} onClick={() => editar(b)} className="p-2 text-gray-600"><Pencil size={16} /></button>
              <button type="button" title="Cancelar baixa" aria-label="Cancelar baixa" disabled={ocupado} onClick={() => cancelar(b)} className="p-2 text-red-600"><Undo2 size={16} /></button>
            </>}
          </div>)}
        </div>}
        {(restante > 0 || editando) && <form onSubmit={salvar} className="space-y-3">
          <h3 className="font-semibold text-sm">{editando ? 'Corrigir baixa' : 'Nova baixa'}</h3>
          <fieldset disabled={ocupado} className="space-y-3">
            <label className="block text-sm">Valor (R$)<CurrencyInput name="valor" value={valor} onChange={setValor} className="input-field" /></label>
            <label className="block text-sm">Data<input type="date" required value={data} onChange={e => setData(e.target.value)} className="input-field" /></label>
            <label className="block text-sm">Meio<select aria-label="Meio" value={meio} onChange={e => { setMeio(e.target.value as BaixaConta['meio']); setDestino('') }} className="input-field">
              <option value="dinheiro">Dinheiro</option><option value="conta">Conta bancária</option>
              {!receber && <option value="cartao">Cartão de crédito</option>}
            </select></label>
            {meio !== 'dinheiro' && <label className="block text-sm">{meio === 'conta' ? 'Conta bancária' : 'Cartão'}<select aria-label={meio === 'conta' ? 'Conta bancária' : 'Cartão'} required value={destino} onChange={e => setDestino(e.target.value)} className="input-field">
              <option value="">Selecione</option>
              {(meio === 'conta' ? contas : cartoes).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></label>}
            <div className="flex gap-2">
              {editando && <button type="button" onClick={() => { setEditando(null); setValor(restante) }} className="btn-secondary">Voltar</button>}
              <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                {ocupado ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {editando ? 'Salvar correção' : receber ? 'Receber' : 'Pagar'}
              </button>
            </div>
          </fieldset>
        </form>}
      </>}
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
    </div>
  </ModalDialog>
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Trash2, Loader2, Pencil, Landmark, CreditCard, ArrowRight,
} from 'lucide-react'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'
import { useNavigate } from 'react-router-dom'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

/* ─────────────── TIPOS ─────────────── */

interface ContaBancaria {
  id: string
  nome: string
  banco: string
  tipo: string
  saldo_inicial: number
  cor: string
}

interface CartaoCredito {
  id: string
  nome: string
  bandeira: string
  limite: number
  dia_fechamento: number
  dia_vencimento: number
  cor: string
}

/* ─────────────── CONSTANTES ─────────────── */

const TIPOS_CONTA = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'digital', label: 'Digital' },
]

const BANDEIRAS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'outro', label: 'Outro' },
]

const CORES_PRESET = [
  '#2E7D5E', '#1A3C5E', '#7C3AED', '#DC2626', '#D97706',
  '#0891B2', '#059669', '#9333EA', '#E11D48', '#0284C7',
]

const TIPO_CONTA_LABELS: Record<string, string> = {
  corrente: 'Corrente', poupanca: 'Poupança', investimento: 'Investimento', digital: 'Digital',
}

const BANDEIRA_LABELS: Record<string, string> = {
  visa: 'Visa', mastercard: 'Mastercard', elo: 'Elo', amex: 'Amex', hipercard: 'Hipercard', outro: 'Outro',
}

/* ─────────────── SCHEMAS ─────────────── */

const contaSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  banco: z.string().min(1, 'Banco obrigatório'),
  tipo: z.enum(['corrente', 'poupanca', 'investimento', 'digital']),
  saldo_inicial: z.coerce.number().min(0, 'Saldo não pode ser negativo'),
  cor: z.string().default('#2E7D5E'),
})
type ContaFormData = z.infer<typeof contaSchema>

const cartaoSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  bandeira: z.enum(['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro']),
  limite: z.coerce.number().positive('Limite deve ser positivo'),
  dia_fechamento: z.coerce.number().int().min(1).max(31),
  dia_vencimento: z.coerce.number().int().min(1).max(31),
  cor: z.string().default('#1A3C5E'),
})
type CartaoFormData = z.infer<typeof cartaoSchema>

/* ─────────────── MODAL CONTA BANCÁRIA ─────────────── */

function ContaBancariaModal({
  conta,
  onClose,
  onSuccess,
}: {
  conta?: ContaBancaria
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!conta
  const [erro, setErro] = useState('')
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContaFormData>({
    resolver: zodResolver(contaSchema),
    defaultValues: conta
      ? { nome: conta.nome, banco: conta.banco, tipo: conta.tipo as ContaFormData['tipo'], saldo_inicial: conta.saldo_inicial, cor: conta.cor }
      : { tipo: 'corrente', saldo_inicial: 0, cor: '#2E7D5E' },
  })

  const corAtual = watch('cor')

  async function onSubmit(data: ContaFormData) {
    try {
      setErro('')
      if (isEdit) {
        await api.patch(`/contas-bancarias/${conta!.id}`, data)
      } else {
        await api.post('/contas-bancarias', data)
      }
      onSuccess()
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErro(msg ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <ModalDialog
      title={isEdit ? 'Editar conta bancária' : 'Nova conta bancária'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da conta</label>
              <input
                type="text"
                className={`input-field ${errors.nome ? 'border-danger-500' : ''}`}
                placeholder="Ex.: Nubank Conta"
                {...register('nome')}
              />
              {errors.nome && <p className="text-xs text-danger-600 mt-1">{errors.nome.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
              <input
                type="text"
                className={`input-field ${errors.banco ? 'border-danger-500' : ''}`}
                placeholder="Ex.: Nubank"
                {...register('banco')}
              />
              {errors.banco && <p className="text-xs text-danger-600 mt-1">{errors.banco.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select className="input-field" {...register('tipo')}>
                {TIPOS_CONTA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Saldo inicial (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`input-field ${errors.saldo_inicial ? 'border-danger-500' : ''}`}
                placeholder="0,00"
                {...register('saldo_inicial')}
              />
              {errors.saldo_inicial && <p className="text-xs text-danger-600 mt-1">{errors.saldo_inicial.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cor do cartão</label>
            <div className="flex gap-2 flex-wrap">
              {CORES_PRESET.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setValue('cor', cor)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${corAtual === cor ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>
          {erro && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erro}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {isEdit ? 'Salvar alterações' : 'Adicionar conta'}
          </button>
        </form>
    </ModalDialog>
  )
}

/* ─────────────── MODAL CARTÃO DE CRÉDITO ─────────────── */

function CartaoModal({
  cartao,
  onClose,
  onSuccess,
}: {
  cartao?: CartaoCredito
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!cartao
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CartaoFormData>({
    resolver: zodResolver(cartaoSchema),
    defaultValues: cartao
      ? { nome: cartao.nome, bandeira: cartao.bandeira as CartaoFormData['bandeira'], limite: cartao.limite, dia_fechamento: cartao.dia_fechamento, dia_vencimento: cartao.dia_vencimento, cor: cartao.cor }
      : { bandeira: 'visa', dia_fechamento: 1, dia_vencimento: 10, cor: '#1A3C5E' },
  })

  const corAtual = watch('cor')
  const [erro, setErro] = useState('')

  async function onSubmit(data: CartaoFormData) {
    setErro('')
    try {
      if (isEdit) {
        await api.patch(`/cartoes-credito/${cartao!.id}`, data)
      } else {
        await api.post('/cartoes-credito', data)
      }
      onSuccess()
      onClose()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErro(detail ?? 'Erro ao salvar. Tente novamente.')
    }
  }

  return (
    <ModalDialog
      title={isEdit ? 'Editar cartão' : 'Novo cartão de crédito'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do cartão</label>
              <input
                type="text"
                className={`input-field ${errors.nome ? 'border-danger-500' : ''}`}
                placeholder="Ex.: Nubank Roxinho"
                {...register('nome')}
              />
              {errors.nome && <p className="text-xs text-danger-600 mt-1">{errors.nome.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bandeira</label>
              <select className="input-field" {...register('bandeira')}>
                {BANDEIRAS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Limite (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={`input-field ${errors.limite ? 'border-danger-500' : ''}`}
                placeholder="0,00"
                {...register('limite')}
              />
              {errors.limite && <p className="text-xs text-danger-600 mt-1">{errors.limite.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dia fechamento</label>
              <input
                type="number"
                min="1"
                max="31"
                className={`input-field ${errors.dia_fechamento ? 'border-danger-500' : ''}`}
                {...register('dia_fechamento')}
              />
              {errors.dia_fechamento && <p className="text-xs text-danger-600 mt-1">Informe entre 1 e 31</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dia vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                className={`input-field ${errors.dia_vencimento ? 'border-danger-500' : ''}`}
                {...register('dia_vencimento')}
              />
              {errors.dia_vencimento && <p className="text-xs text-danger-600 mt-1">Informe entre 1 e 31</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cor do cartão</label>
            <div className="flex gap-2 flex-wrap">
              {CORES_PRESET.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setValue('cor', cor)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${corAtual === cor ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
          </div>
          {erro && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{erro}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {isEdit ? 'Salvar alterações' : 'Adicionar cartão'}
          </button>
        </form>
    </ModalDialog>
  )
}

/* ─────────────── CARD VISUAL CONTA BANCÁRIA ─────────────── */

function ContaBancariaCard({
  conta,
  onEdit,
  onDelete,
}: {
  conta: ContaBancaria
  onEdit: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      {/* Topo colorido — clicável para lançamentos */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/contas-bancarias/${conta.id}/lancamentos`)}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/contas-bancarias/${conta.id}/lancamentos`)}
        className="block p-4 text-white active:opacity-80 transition-opacity cursor-pointer select-none"
        style={{ backgroundColor: conta.cor }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80">{conta.banco}</p>
            <p className="font-semibold text-lg leading-tight">{conta.nome}</p>
          </div>
          <Landmark size={28} className="opacity-70" />
        </div>
        <p className="mt-3 text-2xl font-bold">{formatCurrency(conta.saldo_inicial)}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs opacity-70">Saldo inicial</p>
          <span className="text-xs opacity-70 flex items-center gap-1">
            Ver lançamentos <ArrowRight size={12} />
          </span>
        </div>
      </div>
      {/* Rodapé */}
      <div className="bg-white px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {TIPO_CONTA_LABELS[conta.tipo] ?? conta.tipo}
        </span>
        <div className="flex gap-1 items-center">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── CARD VISUAL CARTÃO DE CRÉDITO ─────────────── */

function CartaoCreditoCard({
  cartao,
  onEdit,
  onDelete,
}: {
  cartao: CartaoCredito
  onEdit: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      {/* Topo colorido — clicável para lançamentos */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/cartoes-credito/${cartao.id}/lancamentos`)}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/cartoes-credito/${cartao.id}/lancamentos`)}
        className="block p-4 text-white active:opacity-80 transition-opacity cursor-pointer select-none"
        style={{ backgroundColor: cartao.cor }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80">{BANDEIRA_LABELS[cartao.bandeira] ?? cartao.bandeira}</p>
            <p className="font-semibold text-lg leading-tight">{cartao.nome}</p>
          </div>
          <CreditCard size={28} className="opacity-70" />
        </div>
        <p className="mt-3 text-2xl font-bold">{formatCurrency(cartao.limite)}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs opacity-70">Limite total</p>
          <span className="text-xs opacity-70 flex items-center gap-1">
            Ver lançamentos <ArrowRight size={12} />
          </span>
        </div>
      </div>
      {/* Rodapé */}
      <div className="bg-white px-4 py-2 flex items-center justify-between">
        <div className="flex gap-4 text-xs text-gray-500">
          <span>Fecha dia <strong className="text-gray-700">{cartao.dia_fechamento}</strong></span>
          <span>Vence dia <strong className="text-gray-700">{cartao.dia_vencimento}</strong></span>
        </div>
        <div className="flex gap-1 items-center">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────── PÁGINA PRINCIPAL ─────────────── */

type Tab = 'contas' | 'cartoes'

export default function ContasBancariasPage() {
  const [tab, setTab] = useState<Tab>('contas')
  const [showContaModal, setShowContaModal] = useState(false)
  const [showCartaoModal, setShowCartaoModal] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaBancaria | null>(null)
  const [editingCartao, setEditingCartao] = useState<CartaoCredito | null>(null)

  const queryClient = useQueryClient()

  const { data: contas = [], isLoading: loadingContas } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/contas-bancarias').then((r) => r.data),
  })

  const { data: cartoes = [], isLoading: loadingCartoes } = useQuery<CartaoCredito[]>({
    queryKey: ['cartoes-credito'],
    queryFn: () => api.get('/cartoes-credito').then((r) => r.data),
  })

  const deletarConta = useMutation({
    mutationFn: (id: string) => api.delete(`/contas-bancarias/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] }),
  })

  const deletarCartao = useMutation({
    mutationFn: (id: string) => api.delete(`/cartoes-credito/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cartoes-credito'] }),
  })

  function handleDeleteConta(id: string) {
    if (confirm('Remover esta conta bancária?')) deletarConta.mutate(id)
  }

  function handleDeleteCartao(id: string) {
    if (confirm('Remover este cartão?')) deletarCartao.mutate(id)
  }

  const totalSaldo = contas.reduce((s, c) => s + c.saldo_inicial, 0)
  const totalLimite = cartoes.reduce((s, c) => s + c.limite, 0)

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <PageHeader
        title="Contas e Cartões"
        action={{
          label: tab === 'contas' ? 'Nova conta' : 'Novo cartão',
          onClick: () => tab === 'contas' ? setShowContaModal(true) : setShowCartaoModal(true),
        }}
      />

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('contas')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'contas' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Landmark size={16} />
          Contas Bancárias
        </button>
        <button
          onClick={() => setTab('cartoes')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'cartoes' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <CreditCard size={16} />
          Cartões de Crédito
        </button>
      </div>

      {/* Resumo */}
      {tab === 'contas' && contas.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-primary-700 font-medium">Total em contas</span>
          <span className="text-lg font-bold text-primary-700">{formatCurrency(totalSaldo)}</span>
        </div>
      )}
      {tab === 'cartoes' && cartoes.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">Limite total</span>
          <span className="text-lg font-bold text-blue-700">{formatCurrency(totalLimite)}</span>
        </div>
      )}

      {/* Conteúdo */}
      {tab === 'contas' && (
        <>
          {loadingContas ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary-500" size={28} />
            </div>
          ) : contas.length === 0 ? (
            <EmptyState icon={Landmark} title="Nenhuma conta cadastrada" description={'Clique em "Nova conta" para começar'} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contas.map((conta) => (
                <ContaBancariaCard
                  key={conta.id}
                  conta={conta}
                  onEdit={() => { setEditingConta(conta); setShowContaModal(true) }}
                  onDelete={() => handleDeleteConta(conta.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'cartoes' && (
        <>
          {loadingCartoes ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary-500" size={28} />
            </div>
          ) : cartoes.length === 0 ? (
            <EmptyState icon={CreditCard} title="Nenhum cartão cadastrado" description={'Clique em "Novo cartão" para começar'} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cartoes.map((cartao) => (
                <CartaoCreditoCard
                  key={cartao.id}
                  cartao={cartao}
                  onEdit={() => { setEditingCartao(cartao); setShowCartaoModal(true) }}
                  onDelete={() => handleDeleteCartao(cartao.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modais */}
      {showContaModal && (
        <ContaBancariaModal
          conta={editingConta ?? undefined}
          onClose={() => { setShowContaModal(false); setEditingConta(null) }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['contas-bancarias'] })}
        />
      )}
      {showCartaoModal && (
        <CartaoModal
          cartao={editingCartao ?? undefined}
          onClose={() => { setShowCartaoModal(false); setEditingCartao(null) }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['cartoes-credito'] })}
        />
      )}
    </div>
  )
}

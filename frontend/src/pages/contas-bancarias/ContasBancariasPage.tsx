import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Trash2, Loader2, Pencil, Landmark, CreditCard, ArrowRight,
} from 'lucide-react'
import { formatCurrency } from '@/utils/format'
import { useNavigate } from 'react-router-dom'
import { useContas } from '@/hooks/useContas'
import type { ContaBancaria, CartaoCredito } from '@/types/financeiro'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ContaBancariaModal } from './ContaBancariaModal'
import { CartaoModal } from './CartaoModal'

/* ─────────────── CONSTANTES ─────────────── */

const TIPO_CONTA_LABELS: Record<string, string> = {
  corrente: 'Corrente', poupanca: 'Poupança', investimento: 'Investimento', digital: 'Digital',
}

const BANDEIRA_LABELS: Record<string, string> = {
  visa: 'Visa', mastercard: 'Mastercard', elo: 'Elo', amex: 'Amex', hipercard: 'Hipercard', outro: 'Outro',
}

interface ContaBancariaCardProps {
  conta: ContaBancaria
  onEdit: () => void
  onDelete: () => void
}

interface CartaoCreditoCardProps {
  cartao: CartaoCredito
  onEdit: () => void
  onDelete: () => void
}

function ContaBancariaCard({
  conta,
  onEdit,
  onDelete,
}: ContaBancariaCardProps) {
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
}: CartaoCreditoCardProps) {
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
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('contas')
  const [showContaModal, setShowContaModal] = useState(false)
  const [showCartaoModal, setShowCartaoModal] = useState(false)
  const [editingConta, setEditingConta] = useState<ContaBancaria | null>(null)
  const [editingCartao, setEditingCartao] = useState<CartaoCredito | null>(null)

  const { contas, cartoes, isLoading: loadingContas, deletarConta, deletarCartao } = useContas()
  const loadingCartoes = false // incluído no isLoading acima

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

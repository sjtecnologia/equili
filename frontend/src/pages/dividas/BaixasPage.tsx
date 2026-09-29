import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, X, Pencil, Trash2, Search, History, AlertCircle, RefreshCcw } from 'lucide-react'
import api from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Baixa } from '@/types/financeiro'
import { useInlineEdit } from '@/hooks/useInlineEdit'

export default function BaixasPage() {
  const queryClient = useQueryClient()
  const queryKey = ['divida-baixas']

  const { data: baixas = [], isLoading, isError, refetch } = useQuery<Baixa[]>({
    queryKey,
    queryFn: () =>
      api.get('/dividas/pagamentos').then((r) => {
        const data = Array.isArray(r.data) ? r.data : []
        return data.map((item): Baixa => ({
          id: String(item?.id ?? ''),
          divida_id: String(item?.divida_id ?? ''),
          divida_descricao: String(item?.divida_descricao ?? 'Dívida sem descrição'),
          divida_credor: item?.divida_credor ? String(item.divida_credor) : null,
          data_referencia: String(item?.data_referencia ?? ''),
          data_pagamento: item?.data_pagamento ? String(item.data_pagamento) : null,
          valor_pago: Number(item?.valor_pago ?? 0),
          valor_parcela_original: Number(item?.valor_parcela_original ?? 0),
          observacao: item?.observacao ? String(item.observacao) : null,
        }))
      }),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const [busca, setBusca] = useState('')
  const { editState, editDispatch } = useInlineEdit()

  const deleteMutation = useMutation({
    mutationFn: ({ dividaId, id }: { dividaId: string; id: string }) =>
      api.delete(`/dividas/${dividaId}/pagamentos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['dividas'] })
    },
  })

  function abrirEdicao(b: Baixa) {
    editDispatch({
      type: 'OPEN_EDIT',
      id: b.id,
      form: {
        data_referencia: b.data_referencia,
        data_pagamento: b.data_pagamento ?? '',
        valor_pago: String(b.valor_pago).replace('.', ','),
        observacao: b.observacao ?? '',
      },
    })
  }

  async function salvarEdicao(b: Baixa) {
    if (editState.mode !== 'editing') return
    const { form } = editState
    const valorNum = parseFloat(form.valor_pago.replace(',', '.'))
    if (!valorNum || valorNum <= 0) {
      editDispatch({ type: 'SAVE_ERROR', message: 'Valor inválido' })
      return
    }
    editDispatch({ type: 'SAVE_START' })
    try {
      await api.patch(`/dividas/${b.divida_id}/pagamentos/${b.id}`, {
        data_referencia: form.data_referencia || null,
        data_pagamento: form.data_pagamento || null,
        valor_pago: valorNum,
        observacao: form.observacao.trim() || null,
      })
      await queryClient.invalidateQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey: ['dividas'] })
      editDispatch({ type: 'SAVE_SUCCESS' })
    } catch {
      editDispatch({ type: 'SAVE_ERROR', message: 'Erro ao salvar. Verifique os dados.' })
    }
  }

  const baixasFiltradas = useMemo(
    () => baixas.filter((b) => {
      if (!busca.trim()) return true
      const termo = busca.toLowerCase()
      return (
        (b.divida_descricao || '').toLowerCase().includes(termo) ||
        (b.divida_credor?.toLowerCase().includes(termo) ?? false) ||
        (b.observacao?.toLowerCase().includes(termo) ?? false)
      )
    }),
    [baixas, busca]
  )

  function formatarMesReferencia(valor: string) {
    const dt = new Date(`${valor}T00:00:00`)
    if (Number.isNaN(dt.getTime())) return 'não informado'
    return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Baixas de dívidas</h1>
        <p className="text-sm text-gray-500">{baixas.length} pagamento(s) registrado(s)</p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por dívida, credor ou observação..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="input-field pl-9"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <SkeletonList count={4} height="h-20" />
      ) : isError ? (
        <div className="border border-danger-200 rounded-xl bg-danger-50 p-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-danger-600">
            <AlertCircle size={16} />
            <p className="text-sm font-medium">Não foi possível carregar as baixas agora.</p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-primary text-xs inline-flex items-center gap-1"
          >
            <RefreshCcw size={12} />
            Tentar novamente
          </button>
        </div>
      ) : baixasFiltradas.length === 0 ? (
        <EmptyState
          icon={History}
          title={busca ? 'Nenhuma baixa encontrada para essa busca.' : 'Nenhuma baixa registrada ainda.'}
        />
      ) : (
        <div className="space-y-2">
          {baixasFiltradas.map((b) => {
            const diferenca = b.valor_pago - b.valor_parcela_original
            const esteEditando = editState.mode === 'editing' && editState.id === b.id
            const esteConfirmando = editState.mode === 'confirming' && editState.id === b.id

            if (esteEditando && editState.mode === 'editing') {
              const { form, erro: editErro, salvando } = editState
              return (
                <div
                  key={b.id}
                  className="border border-primary-200 rounded-xl p-4 space-y-3 bg-primary-50/30"
                >
                  <div>
                    <p className="text-xs font-medium text-primary-600 uppercase tracking-wide mb-0.5">
                      Editando baixa
                    </p>
                    <p className="text-sm font-semibold text-gray-800">{b.divida_descricao}</p>
                    {b.divida_credor && (
                      <p className="text-xs text-gray-400">{b.divida_credor}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Parcela (mês ref.)
                      </label>
                      <input
                        type="date"
                        className="input-field text-sm py-1.5"
                        value={form.data_referencia}
                        onChange={(e) =>
                          editDispatch({ type: 'UPDATE_FORM', patch: { data_referencia: e.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Data do pagamento
                      </label>
                      <input
                        type="date"
                        className="input-field text-sm py-1.5"
                        value={form.data_pagamento}
                        onChange={(e) =>
                          editDispatch({ type: 'UPDATE_FORM', patch: { data_pagamento: e.target.value } })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Valor pago (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input-field text-sm py-1.5"
                      value={form.valor_pago}
                      onChange={(e) =>
                        editDispatch({ type: 'UPDATE_FORM', patch: { valor_pago: e.target.value } })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Observação</label>
                    <input
                      type="text"
                      className="input-field text-sm py-1.5"
                      placeholder="Ex.: multa de atraso"
                      value={form.observacao}
                      maxLength={300}
                      onChange={(e) =>
                        editDispatch({ type: 'UPDATE_FORM', patch: { observacao: e.target.value } })
                      }
                    />
                  </div>

                  {editErro && <p className="text-xs text-danger-500">{editErro}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={() => editDispatch({ type: 'CANCEL_EDIT' })}
                      className="btn-ghost text-xs flex-1"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => salvarEdicao(b)}
                      disabled={salvando}
                      className="btn-primary text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      {salvando && <Loader2 size={12} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={b.id}
                className="border border-gray-100 rounded-xl p-3"
              >
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {b.divida_descricao}
                    </p>
                    {b.divida_credor && (
                      <p className="text-xs text-gray-400 truncate">{b.divida_credor}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-xs text-gray-500">
                        Parcela:{' '}
                        <span className="font-medium text-gray-700">
                          {formatarMesReferencia(b.data_referencia)}
                        </span>
                      </span>
                      {b.data_pagamento && (
                        <span className="text-xs text-gray-500">
                          Pago em:{' '}
                          <span className="font-medium text-gray-700">
                            {formatDate(b.data_pagamento)}
                          </span>
                        </span>
                      )}
                    </div>
                    {b.observacao && (
                      <p className="text-xs text-gray-500 italic mt-0.5">{b.observacao}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold text-gray-800 whitespace-nowrap tabular-nums">{formatCurrency(b.valor_pago)}</p>
                    {diferenca !== 0 && (
                      <p
                        className={`text-xs ${diferenca > 0 ? 'text-danger-500' : 'text-success-600'}`}
                      >
                        {diferenca > 0 ? '+' : ''}
                        {formatCurrency(diferenca)}
                      </p>
                    )}
                    <div className="flex gap-1 justify-end mt-2">
                      <button
                        onClick={() => abrirEdicao(b)}
                        className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                        aria-label="Editar baixa"
                      >
                        <Pencil size={14} />
                      </button>
                      {esteConfirmando ? (
                        <div className="flex gap-1 items-center">
                          <button
                            onClick={() => {
                              deleteMutation.mutate({ dividaId: b.divida_id, id: b.id })
                              editDispatch({ type: 'CANCEL_CONFIRM' })
                            }}
                            className="text-xs text-danger-500 font-medium hover:underline"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => editDispatch({ type: 'CANCEL_CONFIRM' })}
                            className="text-xs text-gray-400 hover:underline"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => editDispatch({ type: 'OPEN_CONFIRM', id: b.id })}
                          className="text-gray-300 hover:text-danger-500 transition-colors p-1"
                          aria-label="Excluir baixa"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

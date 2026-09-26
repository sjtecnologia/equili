import { FormEvent, useMemo, useState } from 'react'
import { Check, Circle, ListTodo, ShoppingCart, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { useListas } from '@/hooks/useListas'

type Aba = 'tarefas' | 'compras'

function normalizarQuantidade(valor: string): number {
  const numero = Number(valor.replace(',', '.'))
  if (!Number.isFinite(numero) || numero <= 0) {
    return 1
  }
  return numero
}

export default function ListasPage() {
  const [aba, setAba] = useState<Aba>('tarefas')
  const [novaTarefa, setNovaTarefa] = useState('')
  const [novoItemNome, setNovoItemNome] = useState('')
  const [novoItemQuantidade, setNovoItemQuantidade] = useState('1')
  const [novoItemUnidade, setNovoItemUnidade] = useState('')

  const {
    tarefas,
    compras,
    isLoading,
    criarTarefa,
    atualizarTarefa,
    removerTarefa,
    criarItemCompra,
    atualizarItemCompra,
    removerItemCompra,
  } = useListas()

  const tarefasPendentes = useMemo(
    () => tarefas.filter((tarefa) => !tarefa.concluida).length,
    [tarefas]
  )

  const itensPendentes = useMemo(
    () => compras.filter((item) => !item.comprado).length,
    [compras]
  )

  async function handleCriarTarefa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const titulo = novaTarefa.trim()
    if (!titulo) return

    await criarTarefa.mutateAsync({ titulo })
    setNovaTarefa('')
  }

  async function handleCriarItemCompra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nome = novoItemNome.trim()
    if (!nome) return

    const quantidade = normalizarQuantidade(novoItemQuantidade)
    const unidade = novoItemUnidade.trim()

    await criarItemCompra.mutateAsync({
      nome,
      quantidade,
      ...(unidade ? { unidade } : {}),
    })

    setNovoItemNome('')
    setNovoItemQuantidade('1')
    setNovoItemUnidade('')
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <PageHeader
        title="Listas"
        subtitle="Organize afazeres e compras do dia"
      />

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setAba('tarefas')}
          className={`card p-4 text-left border transition-colors ${
            aba === 'tarefas' ? 'border-primary-500 bg-primary-50' : 'border-transparent'
          }`}
        >
          <div className="flex items-center gap-2 text-gray-700">
            <ListTodo size={16} />
            <p className="text-sm font-semibold">Afazeres</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {tarefasPendentes} pendente(s)
          </p>
        </button>

        <button
          onClick={() => setAba('compras')}
          className={`card p-4 text-left border transition-colors ${
            aba === 'compras' ? 'border-primary-500 bg-primary-50' : 'border-transparent'
          }`}
        >
          <div className="flex items-center gap-2 text-gray-700">
            <ShoppingCart size={16} />
            <p className="text-sm font-semibold">Compras</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {itensPendentes} item(ns) faltando
          </p>
        </button>
      </div>

      {aba === 'tarefas' && (
        <>
          <form onSubmit={handleCriarTarefa} className="card p-3 flex gap-2">
            <input
              value={novaTarefa}
              onChange={(e) => setNovaTarefa(e.target.value)}
              className="input-field"
              placeholder="Adicionar afazer"
              maxLength={200}
            />
            <button
              type="submit"
              disabled={criarTarefa.isPending}
              className="btn-primary whitespace-nowrap"
            >
              Adicionar
            </button>
          </form>

          {isLoading ? (
            <SkeletonList count={4} height="h-16" />
          ) : tarefas.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="Nenhum afazer por enquanto."
              description="Crie sua primeira tarefa para organizar o dia."
            />
          ) : (
            <div className="space-y-2">
              {tarefas.map((tarefa) => (
                <div key={tarefa.id} className="card p-3 flex items-center gap-3">
                  <button
                    onClick={() => atualizarTarefa.mutate({ id: tarefa.id, concluida: !tarefa.concluida })}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                      tarefa.concluida
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 text-gray-300 hover:border-primary-500'
                    }`}
                    aria-label={tarefa.concluida ? 'Desmarcar tarefa' : 'Marcar tarefa concluida'}
                  >
                    {tarefa.concluida ? <Check size={14} /> : <Circle size={14} />}
                  </button>

                  <p className={`flex-1 text-sm ${tarefa.concluida ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {tarefa.titulo}
                  </p>

                  <button
                    onClick={() => removerTarefa.mutate(tarefa.id)}
                    className="text-gray-300 hover:text-danger-500 p-1"
                    aria-label="Remover tarefa"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {aba === 'compras' && (
        <>
          <form onSubmit={handleCriarItemCompra} className="card p-3 space-y-2">
            <input
              value={novoItemNome}
              onChange={(e) => setNovoItemNome(e.target.value)}
              className="input-field"
              placeholder="Item de compra"
              maxLength={200}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={novoItemQuantidade}
                onChange={(e) => setNovoItemQuantidade(e.target.value)}
                className="input-field"
                placeholder="Quantidade"
              />
              <input
                value={novoItemUnidade}
                onChange={(e) => setNovoItemUnidade(e.target.value)}
                className="input-field"
                placeholder="Unidade (kg, un, L...)"
                maxLength={30}
              />
            </div>
            <button
              type="submit"
              disabled={criarItemCompra.isPending}
              className="btn-primary w-full"
            >
              Adicionar item
            </button>
          </form>

          {isLoading ? (
            <SkeletonList count={4} height="h-16" />
          ) : compras.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Sua lista de compras está vazia."
              description="Adicione itens para não esquecer nada no mercado."
            />
          ) : (
            <div className="space-y-2">
              {compras.map((item) => (
                <div key={item.id} className="card p-3 flex items-center gap-3">
                  <button
                    onClick={() => atualizarItemCompra.mutate({ id: item.id, comprado: !item.comprado })}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                      item.comprado
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 text-gray-300 hover:border-primary-500'
                    }`}
                    aria-label={item.comprado ? 'Desmarcar item comprado' : 'Marcar item comprado'}
                  >
                    {item.comprado ? <Check size={14} /> : <Circle size={14} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.comprado ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.nome}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.quantidade} {item.unidade ?? 'un'}
                    </p>
                  </div>

                  <button
                    onClick={() => removerItemCompra.mutate(item.id)}
                    className="text-gray-300 hover:text-danger-500 p-1"
                    aria-label="Remover item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Tags, Loader2, Power } from 'lucide-react'
import api from '@/services/api'
import { notify } from '@/utils/notify'
import { parseApiError } from '@/utils/api'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModalDialog } from '@/components/ui/ModalDialog'

interface Categoria {
  id: string
  nome: string
  tipo: 'despesa' | 'receita'
  cor: string | null
  icone: string | null
  ativo: boolean
}

type FormState = { nome: string; tipo: '' | 'despesa' | 'receita'; cor: string; icone: string }

const EMPTY_FORM: FormState = { nome: '', tipo: '', cor: '#2E7D5E', icone: '' }

function CategoriaModal({
  categoria,
  defaultTipo,
  onClose,
  onSaved,
}: {
  categoria: Categoria | null
  defaultTipo: '' | 'despesa' | 'receita'
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(
    categoria
      ? { nome: categoria.nome, tipo: categoria.tipo, cor: categoria.cor ?? '#2E7D5E', icone: categoria.icone ?? '' }
      : { ...EMPTY_FORM, tipo: defaultTipo },
  )
  const [errors, setErrors] = useState<{ nome?: string; tipo?: string }>({})
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: { nome?: string; tipo?: string } = {}
    if (!form.nome.trim()) errs.nome = 'Informe o nome.'
    if (!form.tipo) errs.tipo = 'Selecione o tipo.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    try {
      const payload = { nome: form.nome.trim(), tipo: form.tipo, cor: form.cor || null, icone: form.icone.trim() || null }
      if (categoria) await api.put(`/categorias/${categoria.id}`, payload)
      else await api.post('/categorias', payload)
      notify.success(categoria ? 'Categoria atualizada!' : 'Categoria criada!')
      onSaved()
      onClose()
    } catch (err) {
      notify.error(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalDialog title={categoria ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
      <form onSubmit={submit} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            type="text"
            className={`input-field ${errors.nome ? 'border-danger-500' : ''}`}
            value={form.nome}
            maxLength={80}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
          {errors.nome && <p className="mt-1 text-xs text-danger-500">{errors.nome}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <select
            className={`input-field ${errors.tipo ? 'border-danger-500' : ''}`}
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as FormState['tipo'] })}
          >
            <option value="">Selecione…</option>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
          {errors.tipo && <p className="mt-1 text-xs text-danger-500">{errors.tipo}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
            <input
              type="color"
              className="input-field h-10 p-1"
              value={form.cor}
              onChange={(e) => setForm({ ...form, cor: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ícone</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ex: 🛒"
              maxLength={50}
              value={form.icone}
              onChange={(e) => setForm({ ...form, icone: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

export default function CategoriasPage() {
  const qc = useQueryClient()
  const [filtroTipo, setFiltroTipo] = useState<'' | 'despesa' | 'receita'>('')
  const [modal, setModal] = useState<{ open: boolean; categoria: Categoria | null }>({ open: false, categoria: null })

  const { data: categorias = [], isLoading } = useQuery<Categoria[]>({
    queryKey: ['categorias', filtroTipo],
    queryFn: () => api.get('/categorias', { params: filtroTipo ? { tipo: filtroTipo } : {} }).then((r) => r.data),
  })

  const recarregar = () => qc.invalidateQueries({ queryKey: ['categorias'], refetchType: 'all' })

  async function alternarAtivo(c: Categoria) {
    try {
      await api.put(`/categorias/${c.id}`, { ativo: !c.ativo })
      notify.success(c.ativo ? 'Categoria desativada.' : 'Categoria ativada.')
      recarregar()
    } catch (err) {
      notify.error(parseApiError(err))
    }
  }

  async function excluir(c: Categoria) {
    if (!window.confirm(`Excluir a categoria "${c.nome}"?`)) return
    try {
      await api.delete(`/categorias/${c.id}`)
      notify.success('Categoria excluída.')
      recarregar()
    } catch (err) {
      notify.error(parseApiError(err))
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <PageHeader
        title="Categorias"
        subtitle={`${categorias.length} categoria(s)`}
        action={{ label: 'Nova categoria', onClick: () => setModal({ open: true, categoria: null }) }}
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([['', 'Todas'], ['despesa', 'Despesa'], ['receita', 'Receita']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFiltroTipo(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              filtroTipo === value
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonList count={3} height="h-16" />
      ) : categorias.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma categoria encontrada."
          action={{ label: 'Nova categoria', onClick: () => setModal({ open: true, categoria: null }) }}
        />
      ) : (
        <div className="space-y-3">
          {categorias.map((c) => (
            <div key={c.id} className={`card p-4 flex items-center gap-3 ${c.ativo ? '' : 'opacity-60'}`}>
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: c.cor ?? '#E5E7EB' }}
              >
                {c.icone}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800 truncate">{c.nome}</p>
                <p className="text-xs text-gray-500">
                  {c.tipo === 'despesa' ? 'Despesa' : 'Receita'} · {c.ativo ? 'Ativa' : 'Inativa'}
                </p>
              </div>
              <button
                onClick={() => alternarAtivo(c)}
                className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                aria-label={c.ativo ? 'Desativar categoria' : 'Ativar categoria'}
                title={c.ativo ? 'Desativar' : 'Ativar'}
              >
                <Power size={16} />
              </button>
              <button
                onClick={() => setModal({ open: true, categoria: c })}
                className="text-gray-300 hover:text-primary-500 transition-colors p-1"
                aria-label="Editar categoria"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => excluir(c)}
                className="text-gray-300 hover:text-danger-500 transition-colors p-1"
                aria-label="Excluir categoria"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <CategoriaModal
          categoria={modal.categoria}
          defaultTipo={filtroTipo}
          onClose={() => setModal({ open: false, categoria: null })}
          onSaved={recarregar}
        />
      )}
    </div>
  )
}

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { useMetas } from '@/hooks/useMetas'
import { metaSchema, type MetaFormData } from '@/lib/schemas/financeiro'
import { formatCurrency } from '@/utils/format'
import type { Meta } from '@/types/financeiro'

interface ModalBaseProps {
  onClose: () => void
}

interface MetaFormProps extends ModalBaseProps {
  editing: Meta | null
}

/** Formulário de criação/edição de meta (título, categoria, alvo, aporte inicial, prazo). */
export function MetaForm({ onClose, editing }: MetaFormProps) {
  const { criar, atualizar } = useMetas()
  const { submit, error, isPending } = useFormSubmit()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MetaFormData>({
    resolver: zodResolver(metaSchema),
    defaultValues: editing
      ? {
          titulo: editing.titulo,
          descricao: editing.descricao ?? '',
          categoria: editing.categoria ?? '',
          valor_alvo: editing.valor_alvo,
          prazo: editing.prazo ?? undefined,
        }
      : { valor_alvo: undefined, valor_atual: 0 },
  })

  async function onSubmeter(dados: MetaFormData) {
    await submit(async () => {
      const payload = {
        titulo: dados.titulo.trim(),
        descricao: dados.descricao?.trim() || null,
        categoria: dados.categoria?.trim() || null,
        valor_alvo: dados.valor_alvo,
        prazo: dados.prazo || null,
      }
      if (editing) {
        await atualizar.mutateAsync({ id: editing.id, payload })
      } else {
        await criar.mutateAsync({ ...payload, valor_atual: dados.valor_atual ?? 0 })
      }
      onClose()
    })
  }

  return (
    <ModalDialog
      title={editing ? 'Editar meta' : 'Nova meta'}
      subtitle={editing ? editing.titulo : 'O que você quer alcançar?'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmeter)} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
          <input
            type="text"
            className={`input-field ${errors.titulo ? 'border-danger-500' : ''}`}
            placeholder="Ex.: Reserva de emergência"
            {...register('titulo')}
          />
          {errors.titulo && <p className="mt-1 text-xs text-danger-500">{errors.titulo.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor alvo (R$) *</label>
            <Controller
              name="valor_alvo"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  {...field}
                  className={`input-field ${errors.valor_alvo ? 'border-danger-500' : ''}`}
                />
              )}
            />
            {errors.valor_alvo && (
              <p className="mt-1 text-xs text-danger-500">{errors.valor_alvo.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
            <input type="date" className="input-field" {...register('prazo')} />
          </div>
        </div>

        {!editing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Já guardado (opcional)
            </label>
            <Controller
              name="valor_atual"
              control={control}
              render={({ field }) => (
                <CurrencyInput {...field} className="input-field" placeholder="0,00" />
              )}
            />
            <p className="mt-1 text-xs text-gray-400">Valor inicial já reservado para esta meta.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ex.: Viagem, Casa, Segurança"
            {...register('categoria')}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-danger-100 border border-danger-200 px-3 py-2 text-sm text-danger-500">
            {error}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {editing ? 'Salvar' : 'Criar meta'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

interface AportarModalProps extends ModalBaseProps {
  meta: Meta
}

/** Registra um aporte e atualiza o progresso da meta. */
export function AportarModal({ onClose, meta }: AportarModalProps) {
  const { aportar } = useMetas()
  const { submit, error, isPending } = useFormSubmit()
  const [valor, setValor] = useState<number>(0)
  const [validado, setValidado] = useState(false)

  async function onSubmeter(e: React.FormEvent) {
    e.preventDefault()
    setValidado(true)
    if (valor <= 0) return
    await submit(async () => {
      await aportar.mutateAsync({ id: meta.id, valor })
      onClose()
    })
  }

  return (
    <ModalDialog title="Registrar aporte" subtitle={meta.titulo} onClose={onClose}>
      <form onSubmit={onSubmeter} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
          <CurrencyInput
            value={valor}
            onChange={(v) => setValor(v)}
            className={`input-field ${validado && valor <= 0 ? 'border-danger-500' : ''}`}
          />
          {validado && valor <= 0 && (
            <p className="mt-1 text-xs text-danger-500">Informe um valor maior que zero.</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Faltam <strong>{formatCurrency(meta.restante)}</strong> para concluir.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-danger-100 border border-danger-200 px-3 py-2 text-sm text-danger-500">
            {error}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Aportar
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}
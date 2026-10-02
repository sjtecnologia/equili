import type { SelectHTMLAttributes } from 'react'
import { useCategoriasAtivas } from '@/hooks/useCategoriasAtivas'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  tipo: 'despesa' | 'receita'
  /** Valor atual do campo; mantido como opção mesmo que não esteja cadastrado (contas antigas). */
  valorAtual?: string
  /** Lista usada quando a rota de categorias falha. */
  fallback: { value: string; label: string }[]
}

export function CategoriaSelect({ tipo, valorAtual, fallback, ...selectProps }: Props) {
  const { data, isError } = useCategoriasAtivas(tipo)

  const opcoes = isError
    ? fallback
    : (data ?? []).map((c) => ({ value: c.nome, label: c.nome }))

  const extra = valorAtual && !opcoes.some((o) => o.value === valorAtual)
    ? [{ value: valorAtual, label: fallback.find((f) => f.value === valorAtual)?.label ?? valorAtual }]
    : []

  return (
    <select className="input-field" {...selectProps}>
      <option value="">Sem categoria</option>
      {[...extra, ...opcoes].map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

import type { SelectHTMLAttributes } from 'react'
import { useCategoriasAtivas } from '@/hooks/useCategoriasAtivas'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  tipo: 'despesa' | 'receita'
  /** Valor atual do campo; mantido como opção mesmo que não esteja cadastrado (contas antigas). */
  valorAtual?: string
}

export function CategoriaSelect({ tipo, valorAtual, ...selectProps }: Props) {
  // Se a rota falhar, sobram só "Sem categoria" e o valor atual; não usar disabled (RHF omitiria o valor)
  const { data = [] } = useCategoriasAtivas(tipo)

  const nomes = data.map((c) => c.nome)
  const extra = valorAtual && !nomes.includes(valorAtual) ? [valorAtual] : []

  return (
    <select className="input-field" {...selectProps}>
      <option value="">Sem categoria</option>
      {[...extra, ...nomes].map((nome) => (
        <option key={nome} value={nome}>{nome}</option>
      ))}
    </select>
  )
}

import { type ElementType } from 'react'

interface EmptyStateProps {
  icon: ElementType
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Estado vazio padronizado com ícone, título, descrição e ação opcional.
 * Substitui o padrão `<div className="card p-8 text-center text-gray-400">` repetido em 8+ páginas.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card p-8 text-center text-gray-400 space-y-2">
      <Icon size={32} className="mx-auto opacity-40" />
      <div>
        <p className="font-medium text-gray-600">{title}</p>
        {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 text-primary-500 font-medium text-sm hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

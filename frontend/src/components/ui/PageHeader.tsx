import { type ElementType } from 'react'
import { Plus } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    onClick: () => void
    icon?: ElementType
    disabled?: boolean
  }
}

/**
 * Cabeçalho de página padronizado com título, subtítulo e botão de ação opcional.
 * Substitui o bloco `<div className="flex items-center justify-between">` repetido em 10+ páginas.
 */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  const ActionIcon = action?.icon ?? Plus

  return (
    <div
      className="flex items-center justify-between"
      style={{ paddingLeft: '16px', paddingRight: 'max(env(safe-area-inset-right), 16px)' }}
    >
      <div>
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          disabled={action.disabled}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <ActionIcon size={16} />
          <span className="hidden sm:inline">{action.label}</span>
        </button>
      )}
    </div>
  )
}

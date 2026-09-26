import { X } from 'lucide-react'

interface ModalDialogProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Habilita overflow scroll no corpo do modal (formulários longos) */
  scrollable?: boolean
  /** Subtítulo exibido abaixo do título no header */
  subtitle?: string
}

/**
 * Container reutilizável de modal com overlay, cabeçalho padronizado e botão de fechar.
 * Substitui o wrapper `fixed inset-0 bg-black/40 ...` repetido em todos os modais.
 */
export function ModalDialog({
  title,
  onClose,
  children,
  size = 'md',
  scrollable = false,
  subtitle,
}: ModalDialogProps) {
  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-lg' : 'max-w-md'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className={`bg-white rounded-2xl w-full ${maxW} shadow-xl ${
          scrollable ? 'max-h-[90vh] flex flex-col' : ''
        }`}
      >
        <div
          className={`flex items-center justify-between p-4 border-b ${
            scrollable ? 'sticky top-0 bg-white rounded-t-2xl shrink-0' : ''
          }`}
        >
          <div>
            <h2 className="font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0">
            <X size={20} />
          </button>
        </div>
        {scrollable ? (
          <div className="overflow-y-auto flex-1">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

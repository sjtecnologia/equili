import { X } from 'lucide-react'

interface ModalDialogProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** @deprecated o corpo de todo modal rola; mantido para não quebrar chamadas existentes */
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
  subtitle,
}: ModalDialogProps) {
  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-lg' : 'max-w-md'

  return (
    <div className="modal-overlay">
      <div className={`modal-card ${maxW}`}>
        <div className="modal-header flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 shrink-0">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

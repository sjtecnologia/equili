import { forwardRef, useEffect, useRef, useState } from 'react'

interface CurrencyInputProps {
  value?: number | string
  onChange?: (value: number) => void
  onBlur?: () => void
  name?: string
  className?: string
  placeholder?: string
}

function formatBRL(num: number): string {
  if (!num) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function parseInput(str: string): number {
  // Remove thousand separators (dots), replace decimal comma with dot
  const cleaned = str.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

/**
 * Input de valor monetário no padrão pt-BR.
 * - Exibe formatado (ex: 1.500,00) quando não focado.
 * - Ao focar: remove separadores de milhar para edição fácil (ex: 1500,00).
 * - Aceita apenas dígitos e uma vírgula como separador decimal.
 * - Compatível com react-hook-form via Controller: onChange recebe number.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, onBlur, name, className, placeholder = '0,00' }, ref) => {
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : (value ?? 0)
    const [focused, setFocused] = useState(false)
    const [inputStr, setInputStr] = useState(() => formatBRL(numValue))
    const internalRef = useRef<HTMLInputElement>(null)

    // Sync display when value changes externally (e.g., form reset)
    useEffect(() => {
      if (!focused) {
        setInputStr(formatBRL(numValue))
      }
    }, [numValue, focused])

    function handleFocus() {
      setFocused(true)
      // Remove thousand separators for easier editing: "1.500,00" → "1500,00"
      if (numValue > 0) {
        setInputStr(numValue.toFixed(2).replace('.', ','))
      } else {
        setInputStr('')
      }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value
      // Allow only digits and a single comma
      const sanitized = raw.replace(/[^\d,]/g, '')
      // Prevent more than one comma
      const parts = sanitized.split(',')
      const clean = parts.length > 2 ? parts[0] + ',' + parts.slice(1).join('') : sanitized
      // Limit to 2 decimal places
      const final = clean.includes(',') ? clean.split(',')[0] + ',' + clean.split(',')[1].slice(0, 2) : clean
      setInputStr(final)
      onChange?.(parseInput(final))
    }

    function handleBlur() {
      setFocused(false)
      const num = parseInput(inputStr)
      setInputStr(formatBRL(num))
      onBlur?.()
    }

    return (
      <input
        ref={(node) => {
          // Support both internal ref and forwarded ref
          const mutableInternalRef = internalRef as React.MutableRefObject<HTMLInputElement | null>
          mutableInternalRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node
        }}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        value={inputStr}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    )
  }
)

CurrencyInput.displayName = 'CurrencyInput'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface ScrollThumb {
  visible: boolean
  height: number
  top: number
}

const OCULTO: ScrollThumb = { visible: false, height: 0, top: 0 }
const ALTURA_MINIMA = 28

/**
 * Calcula o thumb de um indicador de scroll sempre visível (iOS/Android têm scrollbar overlay,
 * que só aparece durante o arrasto). Atualiza em scroll, resize e mudança de itens.
 */
export function useScrollIndicator<T extends HTMLElement>(ativo: boolean) {
  const ref = useRef<T>(null)
  const [thumb, setThumb] = useState<ScrollThumb>(OCULTO)

  const atualizar = useCallback(() => {
    const el = ref.current
    if (!el) return
    const { scrollHeight, clientHeight, scrollTop } = el
    if (scrollHeight <= clientHeight + 1) {
      setThumb((t) => (t.visible ? OCULTO : t))
      return
    }
    const altura = Math.max(ALTURA_MINIMA, (clientHeight / scrollHeight) * clientHeight)
    const maxTop = clientHeight - altura
    const top = Math.min(maxTop, Math.max(0, (scrollTop / (scrollHeight - clientHeight)) * maxTop))
    setThumb((t) =>
      t.visible && Math.abs(t.height - altura) < 0.5 && Math.abs(t.top - top) < 0.5
        ? t
        : { visible: true, height: altura, top }
    )
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!ativo || !el) return

    atualizar()
    el.addEventListener('scroll', atualizar, { passive: true })
    window.addEventListener('resize', atualizar)

    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(atualizar) : null
    resize?.observe(el)
    Array.from(el.children).forEach((c) => resize?.observe(c))

    // Itens do menu adicionados/removidos (ex.: item de admin)
    const mutation = new MutationObserver(() => {
      resize?.disconnect()
      resize?.observe(el)
      Array.from(el.children).forEach((c) => resize?.observe(c))
      atualizar()
    })
    mutation.observe(el, { childList: true })

    return () => {
      el.removeEventListener('scroll', atualizar)
      window.removeEventListener('resize', atualizar)
      resize?.disconnect()
      mutation.disconnect()
    }
  }, [ativo, atualizar])

  return { ref, thumb }
}

/**
 * Esqueleto de carregamento reutilizável.
 * Substitui o padrão `{[...Array(n)].map((_, i) => <div key={i} className="card h-16 animate-pulse..." />)}`
 * repetido em 8+ páginas.
 */
export function SkeletonList({
  count = 3,
  height = 'h-16',
}: {
  count?: number
  height?: string
}) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`card ${height} animate-pulse bg-gray-100`} />
      ))}
    </div>
  )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { RelatorioDetalhado } from '@/types/financeiro'

export function useRelatorioDetalhado(enabled: boolean) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [mesDetalhe, setMesDetalhe] = useState(currentMonth)
  const [anoDetalhe, setAnoDetalhe] = useState(currentYear)
  const [filtrosDetalhe, setFiltrosDetalhe] = useState<Record<string, string>>({})

  const { data: detalhado, isLoading: loadingDetalhado } = useQuery<RelatorioDetalhado>({
    queryKey: ['relatorio-detalhado', mesDetalhe, anoDetalhe, filtrosDetalhe],
    queryFn: () =>
      api.get('/relatorio/detalhado', { params: { mes: mesDetalhe, ano: anoDetalhe, ...filtrosDetalhe } }).then((r) => r.data),
    enabled,
    staleTime: 5 * 60_000,
  })

  return { mesDetalhe, setMesDetalhe, anoDetalhe, setAnoDetalhe, filtrosDetalhe, setFiltrosDetalhe, detalhado, loadingDetalhado }
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { ContasPagarDiaData } from '@/types/financeiro'

export function useRelatorioDia(enabled: boolean) {
  const [dataDia, setDataDia] = useState(new Date().toISOString().slice(0, 10))
  const [filtrosDia, setFiltrosDia] = useState<Record<string, string>>({})

  const { data: contasDia, isLoading: loadingDia } = useQuery<ContasPagarDiaData>({
    queryKey: ['contas-pagar-dia', dataDia, filtrosDia],
    queryFn: () => api.get('/relatorio/contas-pagar-dia', { params: { data: dataDia, ...filtrosDia } }).then((r) => r.data),
    enabled,
  })

  return { dataDia, setDataDia, filtrosDia, setFiltrosDia, contasDia, loadingDia }
}

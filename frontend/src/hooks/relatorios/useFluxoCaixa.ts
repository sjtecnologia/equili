import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type { FluxoMes } from '@/types/financeiro'

const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function useFluxoCaixa() {
  const currentYear = new Date().getFullYear()
  const [anoFluxo, setAnoFluxo] = useState(currentYear)

  const { data: fluxoData, isLoading: loadingFluxo } = useQuery<FluxoMes[]>({
    queryKey: ['fluxo-caixa', anoFluxo],
    queryFn: () => api.get(`/relatorio/fluxo-caixa?ano=${anoFluxo}`).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const { chartData, totalEntradas, totalSaidas, saldoAnual } = useMemo(() => {
    const e = fluxoData?.reduce((acc, d) => acc + d.entradas, 0) ?? 0
    const s = fluxoData?.reduce((acc, d) => acc + d.saidas, 0) ?? 0
    return {
      chartData: fluxoData?.map((d, i) => ({ ...d, nome: MESES_ABR[i] })) ?? [],
      totalEntradas: e,
      totalSaidas: s,
      saldoAnual: e - s,
    }
  }, [fluxoData])

  return { anoFluxo, setAnoFluxo, fluxoData, loadingFluxo, chartData, totalEntradas, totalSaidas, saldoAnual }
}

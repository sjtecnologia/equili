import { useSearchParams } from 'react-router-dom'
import { useFluxoCaixa } from './relatorios/useFluxoCaixa'
import { useRelatorioDetalhado } from './relatorios/useRelatorioDetalhado'
import { useRelatorioDia } from './relatorios/useRelatorioDia'
import { useExtratoTab } from './relatorios/useExtratoTab'

export type RelatorioTab = 'fluxo' | 'detalhado' | 'extrato' | 'dia' | 'parcelas'

export function useRelatorios() {
  const [searchParams, setSearchParams] = useSearchParams()

  const tabFromQuery = searchParams.get('tab')
  const tab: RelatorioTab =
    tabFromQuery === 'detalhado' || tabFromQuery === 'extrato' || tabFromQuery === 'dia' || tabFromQuery === 'parcelas'
      ? tabFromQuery
      : 'fluxo'

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const fluxo = useFluxoCaixa()
  const detalhado = useRelatorioDetalhado(tab === 'detalhado')
  const dia = useRelatorioDia(tab === 'dia')
  const extrato = useExtratoTab(tab === 'extrato')

  function handleTabChange(nextTab: RelatorioTab) {
    if (nextTab === tab) return
    const next = new URLSearchParams(searchParams)
    if (nextTab === 'fluxo') next.delete('tab')
    else next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  return {
    // Tab
    tab,
    handleTabChange,
    years,
    // Fluxo de Caixa
    ...fluxo,
    // Detalhado
    ...detalhado,
    // Por Dia
    ...dia,
    // Extrato
    ...extrato,
  }
}

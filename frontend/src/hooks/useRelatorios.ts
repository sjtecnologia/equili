import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import api from '@/services/api'
import type {
  ContaBancaria,
  CartaoCredito,
  ContaLancamentosData,
  CartaoLancamentosData,
  Lancamento,
  CartaoLancamento,
  FluxoMes,
  RelatorioDetalhado,
  ContasPagarDiaData,
} from '@/types/financeiro'

export type RelatorioTab = 'fluxo' | 'detalhado' | 'extrato' | 'dia'

export function useRelatorios() {
  const [searchParams, setSearchParams] = useSearchParams()

  const tabFromQuery = searchParams.get('tab')
  const tab: RelatorioTab =
    tabFromQuery === 'detalhado' || tabFromQuery === 'extrato' || tabFromQuery === 'dia'
      ? tabFromQuery
      : 'fluxo'

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [anoFluxo, setAnoFluxo] = useState(currentYear)
  const [mesDetalhe, setMesDetalhe] = useState(currentMonth)
  const [anoDetalhe, setAnoDetalhe] = useState(currentYear)
  const [dataDia, setDataDia] = useState(new Date().toISOString().slice(0, 10))
  const [tipoExtrato, setTipoExtrato] = useState<'conta' | 'cartao'>('conta')
  const [contaExtratoId, setContaExtratoId] = useState('')
  const [cartaoExtratoId, setCartaoExtratoId] = useState('')
  const [mesExtrato, setMesExtrato] = useState(
    String(currentYear) + '-' + String(currentMonth).padStart(2, '0')
  )
  const [copiadoExtrato, setCopiadoExtrato] = useState(false)

  const years = [currentYear - 1, currentYear, currentYear + 1]

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: fluxoData, isLoading: loadingFluxo } = useQuery<FluxoMes[]>({
    queryKey: ['fluxo-caixa', anoFluxo],
    queryFn: () => api.get(`/relatorio/fluxo-caixa?ano=${anoFluxo}`).then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const { data: detalhado, isLoading: loadingDetalhado } = useQuery<RelatorioDetalhado>({
    queryKey: ['relatorio-detalhado', mesDetalhe, anoDetalhe],
    queryFn: () =>
      api.get(`/relatorio/detalhado?mes=${mesDetalhe}&ano=${anoDetalhe}`).then((r) => r.data),
    enabled: tab === 'detalhado',
    staleTime: 5 * 60_000,
  })

  const { data: contasDia, isLoading: loadingDia } = useQuery<ContasPagarDiaData>({
    queryKey: ['contas-pagar-dia', dataDia],
    queryFn: () => api.get(`/relatorio/contas-pagar-dia?data=${dataDia}`).then((r) => r.data),
    enabled: tab === 'dia',
  })

  const {
    data: contasBancarias,
    isLoading: loadingContas,
    isError: contasError,
  } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/contas-bancarias').then((r) => r.data),
    enabled: tab === 'extrato',
  })

  const {
    data: cartoes,
    isLoading: loadingCartoes,
    isError: cartoesError,
  } = useQuery<CartaoCredito[]>({
    queryKey: ['cartoes-credito'],
    queryFn: () => api.get('/cartoes-credito').then((r) => r.data),
    enabled: tab === 'extrato',
  })

  const {
    data: dadosConta,
    isLoading: loadingConta,
    isError: contaLancamentosError,
  } = useQuery<ContaLancamentosData>({
    queryKey: ['conta-lancamentos', contaExtratoId],
    queryFn: () =>
      api.get(`/contas-bancarias/${contaExtratoId}/lancamentos`).then((r) => r.data),
    enabled: tab === 'extrato' && tipoExtrato === 'conta' && !!contaExtratoId,
  })

  const {
    data: dadosCartao,
    isLoading: loadingCartao,
    isError: cartaoLancamentosError,
  } = useQuery<CartaoLancamentosData>({
    queryKey: ['cartao-lancamentos', cartaoExtratoId],
    queryFn: () =>
      api.get(`/cartoes-credito/${cartaoExtratoId}/lancamentos`).then((r) => r.data),
    enabled: tab === 'extrato' && tipoExtrato === 'cartao' && !!cartaoExtratoId,
  })

  // ── Auto-seleção de conta/cartão ──────────────────────────────────────────────

  useEffect(() => {
    if (tab !== 'extrato') return
    const hasContas = (contasBancarias?.length ?? 0) > 0
    const hasCartoes = (cartoes?.length ?? 0) > 0
    if (tipoExtrato === 'conta' && !hasContas && hasCartoes) {
      setTipoExtrato('cartao')
      return
    }
    if (tipoExtrato === 'cartao' && !hasCartoes && hasContas) {
      setTipoExtrato('conta')
    }
  }, [tab, tipoExtrato, contasBancarias, cartoes])

  useEffect(() => {
    if (tab !== 'extrato' || tipoExtrato !== 'conta') return
    if (contaExtratoId) return
    if ((contasBancarias?.length ?? 0) > 0) setContaExtratoId(contasBancarias![0].id)
  }, [tab, tipoExtrato, contaExtratoId, contasBancarias])

  useEffect(() => {
    if (tab !== 'extrato' || tipoExtrato !== 'cartao') return
    if (cartaoExtratoId) return
    if ((cartoes?.length ?? 0) > 0) setCartaoExtratoId(cartoes![0].id)
  }, [tab, tipoExtrato, cartaoExtratoId, cartoes])

  // ── Derivados: Fluxo de Caixa ─────────────────────────────────────────────────

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

  // ── Derivados: Extrato ────────────────────────────────────────────────────────

  const lancamentosExtrato: (Lancamento | CartaoLancamento)[] = useMemo(
    () =>
      tipoExtrato === 'conta'
        ? (dadosConta?.lancamentos ?? [])
        : (dadosCartao?.lancamentos ?? []),
    [tipoExtrato, dadosConta, dadosCartao]
  )

  const mesesDisponiveisExtrato = useMemo(
    () => [...new Set(lancamentosExtrato.map((l) => l.data.slice(0, 7)))].sort().reverse(),
    [lancamentosExtrato]
  )

  const mesEfetivo = mesesDisponiveisExtrato.includes(mesExtrato)
    ? mesExtrato
    : (mesesDisponiveisExtrato[0] ?? mesExtrato)

  const lancamentosDoMes = useMemo(
    () =>
      lancamentosExtrato
        .filter((l) => l.data.slice(0, 7) === mesEfetivo)
        .sort((a, b) => a.data.localeCompare(b.data)),
    [lancamentosExtrato, mesEfetivo]
  )

  const saldoAntesDoMes = useMemo(() => {
    if (tipoExtrato !== 'conta') return 0
    const saldoInicial = dadosConta?.saldo_inicial ?? 0
    return (lancamentosExtrato as Lancamento[])
      .filter((l) => l.data.slice(0, 7) < mesEfetivo)
      .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), saldoInicial)
  }, [tipoExtrato, dadosConta, lancamentosExtrato, mesEfetivo])

  const linhasConta = useMemo(() => {
    if (tipoExtrato !== 'conta') return []
    return (lancamentosDoMes as Lancamento[]).reduce<{ lancamento: Lancamento; saldo: number }[]>(
      (acc, l) => {
        const anterior = acc.length > 0 ? acc[acc.length - 1].saldo : saldoAntesDoMes
        acc.push({ lancamento: l, saldo: anterior + (l.tipo === 'entrada' ? l.valor : -l.valor) })
        return acc
      },
      []
    )
  }, [tipoExtrato, lancamentosDoMes, saldoAntesDoMes])

  const totalEntC = useMemo(
    () =>
      (lancamentosDoMes as Lancamento[])
        .filter((l) => l.tipo === 'entrada')
        .reduce((s, l) => s + l.valor, 0),
    [lancamentosDoMes]
  )
  const totalSaiC = useMemo(
    () =>
      (lancamentosDoMes as Lancamento[])
        .filter((l) => l.tipo === 'saida')
        .reduce((s, l) => s + l.valor, 0),
    [lancamentosDoMes]
  )
  const totalCompras = useMemo(
    () =>
      (lancamentosDoMes as CartaoLancamento[])
        .filter((l) => l.tipo === 'compra')
        .reduce((s, l) => s + l.valor, 0),
    [lancamentosDoMes]
  )
  const totalPagamentosCartao = useMemo(
    () =>
      (lancamentosDoMes as CartaoLancamento[])
        .filter((l) => l.tipo === 'pagamento')
        .reduce((s, l) => s + l.valor, 0),
    [lancamentosDoMes]
  )

  // ── Navegação entre tabs ──────────────────────────────────────────────────────

  function handleTabChange(nextTab: RelatorioTab) {
    if (nextTab === tab) return
    const next = new URLSearchParams(searchParams)
    if (nextTab === 'fluxo') next.delete('tab')
    else next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  function trocarTipoExtrato(tipo: 'conta' | 'cartao') {
    setTipoExtrato(tipo)
    setContaExtratoId('')
    setCartaoExtratoId('')
  }

  return {
    // Tab
    tab,
    handleTabChange,
    years,
    // Fluxo de Caixa
    anoFluxo,
    setAnoFluxo,
    fluxoData,
    loadingFluxo,
    chartData,
    totalEntradas,
    totalSaidas,
    saldoAnual,
    // Detalhado
    mesDetalhe,
    setMesDetalhe,
    anoDetalhe,
    setAnoDetalhe,
    detalhado,
    loadingDetalhado,
    // Por Dia
    dataDia,
    setDataDia,
    contasDia,
    loadingDia,
    // Extrato
    tipoExtrato,
    trocarTipoExtrato,
    contaExtratoId,
    setContaExtratoId,
    cartaoExtratoId,
    setCartaoExtratoId,
    mesExtrato,
    setMesExtrato,
    mesEfetivo,
    copiadoExtrato,
    setCopiadoExtrato,
    contasBancarias: contasBancarias ?? [],
    cartoes: cartoes ?? [],
    loadingContas,
    loadingCartoes,
    contasError,
    cartoesError,
    dadosConta,
    dadosCartao,
    loadingConta,
    loadingCartao,
    contaLancamentosError,
    cartaoLancamentosError,
    lancamentosExtrato,
    lancamentosDoMes,
    mesesDisponiveisExtrato,
    saldoAntesDoMes,
    linhasConta,
    totalEntC,
    totalSaiC,
    totalCompras,
    totalPagamentosCartao,
  }
}

const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

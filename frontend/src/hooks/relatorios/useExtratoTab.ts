import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import type {
  ContaBancaria,
  CartaoCredito,
  ContaLancamentosData,
  CartaoLancamentosData,
  Lancamento,
  CartaoLancamento,
} from '@/types/financeiro'

export function useExtratoTab(enabled: boolean) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [tipoExtrato, setTipoExtrato] = useState<'conta' | 'cartao'>('conta')
  const [contaExtratoId, setContaExtratoId] = useState('')
  const [cartaoExtratoId, setCartaoExtratoId] = useState('')
  const [mesExtrato, setMesExtrato] = useState(
    String(currentYear) + '-' + String(currentMonth).padStart(2, '0')
  )
  const [copiadoExtrato, setCopiadoExtrato] = useState(false)
  const [filtrosExtrato, setFiltrosExtrato] = useState<Record<string, string>>({})

  const {
    data: contasBancarias,
    isLoading: loadingContas,
    isError: contasError,
  } = useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: () => api.get('/contas-bancarias').then((r) => r.data),
    enabled,
  })

  const {
    data: cartoes,
    isLoading: loadingCartoes,
    isError: cartoesError,
  } = useQuery<CartaoCredito[]>({
    queryKey: ['cartoes-credito'],
    queryFn: () => api.get('/cartoes-credito').then((r) => r.data),
    enabled,
  })

  const {
    data: dadosConta,
    isLoading: loadingConta,
    isError: contaLancamentosError,
  } = useQuery<ContaLancamentosData>({
    queryKey: ['conta-lancamentos', contaExtratoId],
    queryFn: () =>
      api.get(`/contas-bancarias/${contaExtratoId}/lancamentos`).then((r) => r.data),
    enabled: enabled && tipoExtrato === 'conta' && !!contaExtratoId,
  })

  const {
    data: dadosCartao,
    isLoading: loadingCartao,
    isError: cartaoLancamentosError,
  } = useQuery<CartaoLancamentosData>({
    queryKey: ['cartao-lancamentos', cartaoExtratoId],
    queryFn: () =>
      api.get(`/cartoes-credito/${cartaoExtratoId}/lancamentos`).then((r) => r.data),
    enabled: enabled && tipoExtrato === 'cartao' && !!cartaoExtratoId,
  })

  // Auto-seleção de conta/cartão
  useEffect(() => {
    if (!enabled) return
    const hasContas = (contasBancarias?.length ?? 0) > 0
    const hasCartoes = (cartoes?.length ?? 0) > 0
    if (tipoExtrato === 'conta' && !hasContas && hasCartoes) {
      setTipoExtrato('cartao')
      return
    }
    if (tipoExtrato === 'cartao' && !hasCartoes && hasContas) {
      setTipoExtrato('conta')
    }
  }, [enabled, tipoExtrato, contasBancarias, cartoes])

  useEffect(() => {
    if (!enabled || tipoExtrato !== 'conta') return
    if (contaExtratoId) return
    if ((contasBancarias?.length ?? 0) > 0) setContaExtratoId(contasBancarias![0].id)
  }, [enabled, tipoExtrato, contaExtratoId, contasBancarias])

  useEffect(() => {
    if (!enabled || tipoExtrato !== 'cartao') return
    if (cartaoExtratoId) return
    if ((cartoes?.length ?? 0) > 0) setCartaoExtratoId(cartoes![0].id)
  }, [enabled, tipoExtrato, cartaoExtratoId, cartoes])

  function trocarTipoExtrato(tipo: 'conta' | 'cartao') {
    setFiltrosExtrato({})
    setTipoExtrato(tipo)
    setContaExtratoId('')
    setCartaoExtratoId('')
  }

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

  const lancamentosMesCompleto = useMemo(
    () =>
      lancamentosExtrato
        .filter((l) => l.data.slice(0, 7) === mesEfetivo)
        .sort((a, b) => a.data.localeCompare(b.data)),
    [lancamentosExtrato, mesEfetivo]
  )

  const correspondeFiltro = (l: Lancamento | CartaoLancamento) =>
    (!filtrosExtrato.tipo || l.tipo === filtrosExtrato.tipo) &&
    (!filtrosExtrato.categoria || l.categoria?.trim().toLocaleLowerCase() === filtrosExtrato.categoria.toLocaleLowerCase()) &&
    (!filtrosExtrato.q || l.descricao.toLocaleLowerCase().includes(filtrosExtrato.q.toLocaleLowerCase())) &&
    (!filtrosExtrato.data_inicio || l.data >= filtrosExtrato.data_inicio) &&
    (!filtrosExtrato.data_fim || l.data <= filtrosExtrato.data_fim)
  const lancamentosDoMes = lancamentosMesCompleto.filter(correspondeFiltro)

  const saldoAntesDoMes = useMemo(() => {
    if (tipoExtrato !== 'conta') return 0
    const saldoInicial = dadosConta?.saldo_inicial ?? 0
    return (lancamentosExtrato as Lancamento[])
      .filter((l) => l.data.slice(0, 7) < mesEfetivo)
      .reduce((acc, l) => acc + (l.tipo === 'entrada' ? l.valor : -l.valor), saldoInicial)
  }, [tipoExtrato, dadosConta, lancamentosExtrato, mesEfetivo])

  const linhasConta = useMemo(() => {
    if (tipoExtrato !== 'conta') return []
    return (lancamentosMesCompleto as Lancamento[]).reduce<{ lancamento: Lancamento; saldo: number }[]>(
      (acc, l) => {
        const anterior = acc.length > 0 ? acc[acc.length - 1].saldo : saldoAntesDoMes
        acc.push({ lancamento: l, saldo: anterior + (l.tipo === 'entrada' ? l.valor : -l.valor) })
        return acc
      },
      []
    )
  }, [tipoExtrato, lancamentosMesCompleto, saldoAntesDoMes])

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

  return {
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
    filtrosExtrato,
    setFiltrosExtrato,
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
    linhasConta: linhasConta.filter(l => correspondeFiltro(l.lancamento)),
    saldoFinalMes: linhasConta[linhasConta.length - 1]?.saldo ?? saldoAntesDoMes,
    totalEntC,
    totalSaiC,
    totalCompras,
    totalPagamentosCartao,
  }
}

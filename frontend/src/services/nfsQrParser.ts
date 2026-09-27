export interface NfsQrData {
  numero: string
  serie: string
  valor: number
  chaveAcesso: string
  codigoVerificacao: string
  cpfCnpj: string
  inscricaoMunicipal: string
  urlConsulta: string
}

function normalizeNumber(value: string | null | undefined): number {
  if (!value) return Number.NaN

  const cleaned = decodeURIComponent(String(value).replace(/\+/g, ' '))
    .replace(/\s+/g, '')
    .replace(/[R$]/gi, '')
    .trim()

  if (!cleaned) return Number.NaN

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  if (cleaned.includes(',')) {
    const normalized = cleaned.replace('.', '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  if (cleaned.includes('.')) {
    const lastDotIndex = cleaned.lastIndexOf('.')
    const fractional = cleaned.slice(lastDotIndex + 1)
    const isProbablyThousandsSeparator = fractional.length === 3 && cleaned.slice(0, lastDotIndex).replace(/\D/g, '').length > 0

    const normalized = isProbablyThousandsSeparator ? cleaned.replace(/\./g, '') : cleaned
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function firstValue(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim()
    if (normalized) return normalized
  }
  return ''
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function collectQueryParams(rawInput: string): Map<string, string> {
  const params = new Map<string, string>()

  const addPair = (key: string, value: string) => {
    const normalizedKey = key?.trim()
    if (!normalizedKey) return

    const decodedKey = decodeURIComponent(normalizedKey.replace(/\+/g, ' '))
    const decodedValue = decodeURIComponent((value ?? '').replace(/\+/g, ' ')).trim()
    if (!decodedKey || !decodedValue) return

    if (!params.has(decodedKey)) {
      params.set(decodedKey, decodedValue)
    }
  }

  const querySource = rawInput.includes('?') ? rawInput.slice(rawInput.indexOf('?') + 1) : rawInput

  for (const chunk of querySource.split(/[&;]/)) {
    if (!chunk.includes('=')) continue
    const [rawKey, ...rest] = chunk.split('=')
    const rawValue = rest.join('=')
    addPair(rawKey, rawValue)
  }

  return params
}

function applyPipeDelimitedPFallback(params: Map<string, string>, rawInput: string) {
  const pValue = rawInput.includes('?') ? (() => {
    try {
      return new URL(rawInput).searchParams.get('p') ?? undefined
    } catch {
      return undefined
    }
  })() : undefined
  const sourceValue = pValue ?? rawInput
  const decodedValue = decodeURIComponent(sourceValue.replace(/%7c/gi, '|'))

  if (!decodedValue || !decodedValue.includes('|')) return

  const parts = decodedValue
    .split('|')
    .map((entry) => String(entry).trim())
    .filter(Boolean)

  if (parts.length < 5 || parts[0].length < 30) return

  const numericSegments = parts.slice(1).filter((segment) => /^\d+$/.test(segment))
  const decimalSegments = parts.slice(1).filter((segment) => /\d+[.,]\d+/.test(segment))

  const chaveAcesso = parts[0]
  const valorRaw = decimalSegments[0] ?? numericSegments[0] ?? ''
  const serie = numericSegments[1] ?? numericSegments[0] ?? '1'
  const numero = numericSegments[2] ?? numericSegments[1] ?? numericSegments[0] ?? '1'
  const codigoVerificacao = parts[parts.length - 1] || 'sem-codigo'

  params.set('chaveAcesso', chaveAcesso)
  params.set('chave_nfse', chaveAcesso)
  params.set('chaveNfse', chaveAcesso)
  params.set('numero', String(numero))
  params.set('numeroNf', String(numero))
  params.set('numeroNfs', String(numero))
  params.set('serie', String(serie))
  params.set('valor', valorRaw)
  params.set('valorTotal', valorRaw)
  params.set('codigoVerificacao', codigoVerificacao)
  params.set('codVerificacao', codigoVerificacao)
}

export function parseNfsQr(rawQr: string): NfsQrData {
  const raw = (rawQr ?? '').trim()
  if (!raw) {
    throw new Error('QR inválido: não contém dados de NFS')
  }

  let urlConsulta = raw
  let params = collectQueryParams(raw)

  if ((raw.includes('|') || raw.includes('%7C') || raw.includes('%7c')) && raw.includes('p=')) {
    try {
      const url = new URL(raw)
      applyPipeDelimitedPFallback(params, url.toString())
    } catch {
      applyPipeDelimitedPFallback(params, decodeURIComponent(raw))
    }
  } else if (raw.includes('|') || raw.includes('%7C') || raw.includes('%7c')) {
    applyPipeDelimitedPFallback(params, decodeURIComponent(raw))
  }

  if (!/^https?:\/\//i.test(urlConsulta)) {
    const hasQueryLikeData = raw.includes('?') || raw.includes('=')
    if (!hasQueryLikeData) {
      throw new Error('QR inválido: não contém dados de NFS')
    }
    urlConsulta = `https://nfs.local/${raw.startsWith('/') ? raw.slice(1) : raw}`
  }

  try {
    const parsedUrl = new URL(urlConsulta)
    const searchParams = parsedUrl.searchParams
    for (const [key, value] of searchParams.entries()) {
      if (!params.has(key)) {
        params.set(key, value)
      }
    }
  } catch {
    // Continua com a leitura do conteúdo bruto do QR quando a URL não for válida.
  }

  const getParam = (...names: string[]) => {
    const normalizedNames = new Set(names.map((name) => normalizeKey(name)))
    for (const [key, value] of params.entries()) {
      if (normalizedNames.has(normalizeKey(key))) {
        return value
      }
    }
    return ''
  }

  const numero = firstValue(
    getParam('numero'),
    getParam('nnf'),
    getParam('numeroNf'),
    getParam('numeroNfs'),
    getParam('numeroNfse'),
    getParam('nnfse')
  )
  const serie = firstValue(
    getParam('serie'),
    getParam('serieNfse'),
    getParam('serieNf'),
    getParam('serienfse')
  )
  const chaveAcesso = firstValue(
    getParam('verificarChaveNfse'),
    getParam('chaveNfse'),
    getParam('chaveAcesso'),
    getParam('chave'),
    getParam('chave_nfse'),
    getParam('chaveacesso')
  )
  const codigoVerificacao = firstValue(
    getParam('codigoVerificacao'),
    getParam('codVerificacao'),
    getParam('codigo_verificacao'),
    getParam('codigoverificacao')
  )
  const cpfCnpj = firstValue(
    getParam('cpf'),
    getParam('cnpj'),
    getParam('cpfCnpj'),
    getParam('cpf_cnpj'),
    getParam('cpfcnpj')
  )
  const inscricaoMunicipal = firstValue(
    getParam('inscricaoMunicipal'),
    getParam('inscricao_municipal'),
    getParam('inscrMunicipal'),
    getParam('inscricaomunicipal')
  )
  const valorRaw = firstValue(
    getParam('valor'),
    getParam('valorNfse'),
    getParam('valorTotal'),
    getParam('valorTotalNfse'),
    getParam('valor_total'),
    getParam('valornfse')
  )

  if (!numero || !chaveAcesso || !valorRaw) {
    throw new Error('QR inválido: não contém dados de NFS')
  }

  const valor = normalizeNumber(valorRaw)
  if (!Number.isFinite(valor)) {
    throw new Error('QR inválido: não contém dados de NFS')
  }

  return {
    numero,
    serie: serie || '001',
    valor,
    chaveAcesso,
    codigoVerificacao: codigoVerificacao || 'sem-codigo',
    cpfCnpj: cpfCnpj || 'não informado',
    inscricaoMunicipal: inscricaoMunicipal || 'não informado',
    urlConsulta: urlConsulta,
  }
}

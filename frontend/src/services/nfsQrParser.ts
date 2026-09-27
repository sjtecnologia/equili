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
    .replace(/\./g, '')
    .replace(',', '.')

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

export function parseNfsQr(rawQr: string): NfsQrData {
  const raw = (rawQr ?? '').trim()
  if (!raw) {
    throw new Error('QR inválido: não contém dados de NFS')
  }

  let urlConsulta = raw
  let params = collectQueryParams(raw)

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

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
  const normalized = value.replace(/\s+/g, '').replace('.', '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function firstValue(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim()
    if (normalized) return normalized
  }
  return ''
}

export function parseNfsQr(rawQr: string): NfsQrData {
  const raw = rawQr?.trim()
  if (!raw) {
    throw new Error('QR inválido: não contém dados de NFS')
  }

  let urlConsulta = raw
  if (!/^https?:\/\//i.test(urlConsulta)) {
    if (!urlConsulta.includes('?')) {
      throw new Error('QR inválido: não contém dados de NFS')
    }
    urlConsulta = `https://nfs.local${urlConsulta.startsWith('/') ? '' : '/'}${urlConsulta}`
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(urlConsulta)
  } catch {
    throw new Error('QR inválido: não contém dados de NFS')
  }

  const params = parsedUrl.searchParams
  const numero = firstValue(
    params.get('numero'),
    params.get('nNF'),
    params.get('numeroNf'),
    params.get('numeroNfs'),
    params.get('nNFse')
  )
  const serie = firstValue(params.get('serie'), params.get('serieNfse'), params.get('serieNf'))
  const chaveAcesso = firstValue(
    params.get('verificarChaveNfse'),
    params.get('chaveNfse'),
    params.get('chaveAcesso'),
    params.get('chave'),
    params.get('chave_nfse')
  )
  const codigoVerificacao = firstValue(
    params.get('codigoVerificacao'),
    params.get('codVerificacao'),
    params.get('codigo_verificacao')
  )
  const cpfCnpj = firstValue(params.get('cpf'), params.get('cnpj'), params.get('cpfCnpj'), params.get('cpf_cnpj'))
  const inscricaoMunicipal = firstValue(
    params.get('inscricaoMunicipal'),
    params.get('inscricao_municipal'),
    params.get('inscrMunicipal')
  )
  const valorRaw = firstValue(params.get('valor'), params.get('valorNfse'), params.get('valorTotal'), params.get('valorTotalNfse'))

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

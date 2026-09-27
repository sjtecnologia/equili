import { describe, expect, it } from 'vitest'

import { parseNfsQr } from './nfsQrParser'

describe('parseNfsQr', () => {
  it('accepts ABRASF-like QR data with currency and alternative field names', () => {
    const qr = 'https://consulta.nfse.com.br/consulta?chave_nfse=12345678901234567890&nNF=456&serie=1&valor=R$%201.234,56&codigo_verificacao=ABC123&cpf=12345678909'

    const parsed = parseNfsQr(qr)

    expect(parsed).toMatchObject({
      numero: '456',
      serie: '1',
      chaveAcesso: '12345678901234567890',
      codigoVerificacao: 'ABC123',
      cpfCnpj: '12345678909',
      valor: 1234.56,
    })
  })

  it('accepts raw query strings without a full URL', () => {
    const qr = 'chaveNfse=12345678901234567890&numeroNfs=789&valorTotal=98,70&codVerificacao=XYZ9&cnpj=11222333444455'

    const parsed = parseNfsQr(qr)

    expect(parsed).toMatchObject({
      numero: '789',
      chaveAcesso: '12345678901234567890',
      codigoVerificacao: 'XYZ9',
      cpfCnpj: '11222333444455',
      valor: 98.7,
    })
  })
})

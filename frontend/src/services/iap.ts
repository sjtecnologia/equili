/**
 * Assinaturas no iOS via App Store + RevenueCat.
 *
 * O app usa a RevenueCat apenas como camada de compra/validação. O backend
 * continua sendo a fonte da verdade do plano: depois de qualquer compra ou
 * restauração, chamamos `POST /assinaturas/iap/sync`, que consulta a API da
 * RevenueCat com a chave secreta do servidor e atualiza o usuário.
 *
 * O `appUserID` da RevenueCat é o UUID do usuário no Equili, para que o webhook
 * consiga vincular a compra à conta correta.
 */
import { Capacitor } from '@capacitor/core'
import {
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  Purchases,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from '@revenuecat/purchases-capacitor'
import api from './api'
import type { NomePlano } from '@/types/financeiro'

const IOS_API_KEY = (import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined)?.trim()

export type PlanoIap = Extract<NomePlano, 'premium' | 'pro'>
export type PeriodicidadeIap = 'mensal' | 'anual'

export interface PacoteIap {
  pacote: PurchasesPackage
  plano: PlanoIap
  periodicidade: PeriodicidadeIap
  /** Preço já localizado pela App Store (ex.: "R$ 19,90"). */
  precoFormatado: string
  preco: number
  moeda: string
}

export type OfertasIap = Partial<
  Record<PlanoIap, Partial<Record<PeriodicidadeIap, PacoteIap>>>
>

export interface ResultadoCompraIap {
  plano: string | null
  /** `false` quando a compra foi concluída, mas o backend ainda não confirmou. */
  sincronizado: boolean
}

let configurado = false
let usuarioAtual: string | null = null
let configurando: Promise<void> | null = null

/** Só habilitamos a compra no app nativo iOS e com a chave pública configurada. */
export function iapDisponivel(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'ios' &&
    Boolean(IOS_API_KEY)
  )
}

function exigirConfiguracao(): string {
  if (!IOS_API_KEY) {
    throw new Error(
      'A compra pelo app não está configurada. Use a versão web ou tente novamente mais tarde.',
    )
  }
  return IOS_API_KEY
}

/**
 * Configura o SDK uma única vez e garante que a sessão da RevenueCat aponta
 * para o usuário logado no Equili.
 */
export async function prepararIap(usuarioId: string): Promise<void> {
  if (!iapDisponivel()) return

  if (!configurado) {
    if (!configurando) {
      const apiKey = exigirConfiguracao()
      configurando = Purchases.configure({ apiKey, appUserID: usuarioId })
        .then(() => {
          configurado = true
          usuarioAtual = usuarioId
        })
        .catch((erro) => {
          configurando = null
          throw erro
        })
    }
    await configurando
    return
  }

  if (usuarioAtual !== usuarioId) {
    await Purchases.logIn({ appUserID: usuarioId })
    usuarioAtual = usuarioId
  }
}

function planoDoProduto(produtoId: string, ofertaId: string): PlanoIap | null {
  const produto = produtoId.toLowerCase()
  if (/(^|[._-])pro([._-]|$)/.test(produto)) return 'pro'
  if (produto.includes('premium')) return 'premium'

  const oferta = ofertaId.toLowerCase()
  if (oferta === 'pro' || oferta.startsWith('pro_') || oferta.startsWith('pro-')) return 'pro'
  if (oferta === 'premium' || oferta.startsWith('premium_') || oferta.startsWith('premium-')) {
    return 'premium'
  }
  return null
}

function periodicidadeDoPacote(pacote: PurchasesPackage): PeriodicidadeIap | null {
  if (pacote.packageType === PACKAGE_TYPE.ANNUAL) return 'anual'
  if (pacote.packageType === PACKAGE_TYPE.MONTHLY) return 'mensal'

  const produto = pacote.product.identifier.toLowerCase()
  if (produto.includes('anual') || produto.includes('annual') || produto.endsWith('.ano')) {
    return 'anual'
  }
  if (produto.includes('mensal') || produto.includes('month')) return 'mensal'
  return null
}

function montarPacote(
  pacote: PurchasesPackage,
  plano: PlanoIap,
  periodicidade: PeriodicidadeIap,
): PacoteIap {
  return {
    pacote,
    plano,
    periodicidade,
    precoFormatado: pacote.product.priceString,
    preco: pacote.product.price,
    moeda: pacote.product.currencyCode,
  }
}

/**
 * Lê as ofertas configuradas na RevenueCat. Aceita tanto duas ofertas
 * (`premium` e `pro`) quanto uma oferta única contendo os quatro produtos.
 */
export async function carregarOfertasIap(usuarioId: string): Promise<OfertasIap> {
  await prepararIap(usuarioId)
  const offerings = await Purchases.getOfferings()

  const lista = offerings.current
    ? [
        offerings.current,
        ...Object.values(offerings.all).filter(
          (oferta) => oferta.identifier !== offerings.current?.identifier,
        ),
      ]
    : Object.values(offerings.all)

  const resultado: OfertasIap = {}

  for (const oferta of lista) {
    for (const pacote of oferta.availablePackages) {
      const plano = planoDoProduto(pacote.product.identifier, oferta.identifier)
      const periodicidade = periodicidadeDoPacote(pacote)
      if (!plano || !periodicidade) continue

      const porPeriodicidade = (resultado[plano] ??= {})
      if (!porPeriodicidade[periodicidade]) {
        porPeriodicidade[periodicidade] = montarPacote(pacote, plano, periodicidade)
      }
    }
  }

  return resultado
}

function planoDoCustomerInfo(info: CustomerInfo): PlanoIap | null {
  if (info.entitlements.active.pro?.isActive) return 'pro'
  if (info.entitlements.active.premium?.isActive) return 'premium'

  // Fallback para quando a entitlement ainda não foi associada no painel.
  const produtos = info.activeSubscriptions.map((id) => id.toLowerCase())
  if (produtos.some((id) => /(^|[._-])pro([._-]|$)/.test(id))) return 'pro'
  if (produtos.some((id) => id.includes('premium'))) return 'premium'
  return null
}

async function sincronizarComBackend(
  planoLocal: PlanoIap | null,
): Promise<ResultadoCompraIap> {
  try {
    const { data } = await api.post<{ status: string; plano: string }>('/assinaturas/iap/sync')
    return { plano: data.plano ?? planoLocal, sincronizado: true }
  } catch {
    // O webhook da RevenueCat ainda pode confirmar a compra em segundo plano.
    return { plano: planoLocal, sincronizado: false }
  }
}

export async function comprarPacoteIap(pacote: PacoteIap): Promise<ResultadoCompraIap> {
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pacote.pacote })
  return sincronizarComBackend(planoDoCustomerInfo(customerInfo))
}

export async function restaurarComprasIap(usuarioId: string): Promise<ResultadoCompraIap> {
  await prepararIap(usuarioId)
  const { customerInfo } = await Purchases.restorePurchases()
  return sincronizarComBackend(planoDoCustomerInfo(customerInfo))
}

/** O usuário fechou a folha de pagamento da App Store. */
export function iapCancelado(erro: unknown): boolean {
  const e = erro as Partial<PurchasesError> | null | undefined
  return Boolean(
    e?.userCancelled ||
      e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
      e?.readableErrorCode === 'PURCHASE_CANCELLED_ERROR',
  )
}

export function mensagemErroIap(erro: unknown): string {
  const e = erro as Partial<PurchasesError> | null | undefined
  if (e?.readableErrorCode === 'NETWORK_ERROR') {
    return 'Não foi possível falar com a App Store. Verifique sua conexão e tente novamente.'
  }
  if (e?.readableErrorCode === 'PRODUCT_ALREADY_PURCHASED_ERROR') {
    return 'Esta assinatura já está vinculada à sua conta Apple. Use "Restaurar compras".'
  }
  if (e?.readableErrorCode === 'PAYMENT_PENDING_ERROR') {
    return 'Seu pagamento está pendente de aprovação. A assinatura será ativada assim que a App Store confirmar.'
  }
  if (erro instanceof Error && erro.message) return erro.message
  return 'Não foi possível concluir a compra. Tente novamente em instantes.'
}

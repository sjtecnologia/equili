import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Crown, Mail, X } from 'lucide-react'
import { listarPlanos } from '@/services/api'
import { usePlano } from '@/hooks/usePlano'
import { PageHeader } from '@/components/ui/PageHeader'
import { Loader2 } from 'lucide-react'
import type { PlanoEntitlements } from '@/types/financeiro'

function preco(v: number): string {
  if (v === 0) return 'Grátis'
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function valorLimite(p: PlanoEntitlements, recurso: string, srIlimitado = 'Ilimitado'): string {
  const v = p.limites[recurso]
  return v === null || v === undefined ? srIlimitado : String(v)
}

function tem(p: PlanoEntitlements, recurso: string): 'sim' | 'nao' {
  return p.recursos.includes(recurso) ? 'sim' : 'nao'
}

interface Linha {
  grupo: string
  rotulo: string
  valor: (p: PlanoEntitlements) => string
}

const LINHAS: Linha[] = [
  { grupo: 'Organização', rotulo: 'Rendas e contas', valor: (p) => valorLimite(p, 'rendas', 'Ilimitado') },
  { grupo: 'Organização', rotulo: 'Dívidas ativas', valor: (p) => valorLimite(p, 'dividas_ativas') },
  { grupo: 'Organização', rotulo: 'Cartões de crédito', valor: (p) => valorLimite(p, 'cartoes_credito') },
  { grupo: 'Organização', rotulo: 'Contas bancárias', valor: (p) => (tem(p, 'contas_bancarias') === 'sim' ? 'Incluído' : 'Não incluído') },
  { grupo: 'Organização', rotulo: 'Investimentos', valor: (p) => (p.recursos.includes('investimentos') ? 'Incluído' : 'Não incluído') },
  { grupo: 'IA', rotulo: 'Plano de Ação IA', valor: (p) => valorLimite(p, 'planos_ia_mes', 'Ilimitado') },
  { grupo: 'IA', rotulo: 'Chat IA', valor: (p) => valorLimite(p, 'chat_msgs_mes', 'Ilimitado') },
  { grupo: 'IA', rotulo: 'Assistente de voz', valor: (p) => (p.recursos.includes('voz') ? 'Incluído' : 'Não incluído') },
  { grupo: 'IA', rotulo: 'Prioridade na IA', valor: (p) => (p.recursos.includes('ia_prioridade') ? 'Incluído' : '—') },
  { grupo: 'Relatórios', rotulo: 'Relatório detalhado', valor: (p) => (p.recursos.includes('relatorios_avancados') ? 'Incluído' : 'Não incluído') },
  { grupo: 'Relatórios', rotulo: 'Exportação Excel', valor: (p) => (p.recursos.includes('exportacao') ? 'Incluído' : 'Não incluído') },
  { grupo: 'Avançado', rotulo: 'Notas Fiscais (NFS-e)', valor: (p) => (p.recursos.includes('nfs') ? 'Incluído' : 'Não incluído') },
  { grupo: 'Avançado', rotulo: 'Membros no espaço', valor: (p) => valorLimite(p, 'membros', 'Ilimitado') },
  { grupo: 'Suporte', rotulo: 'Suporte', valor: (p) => (p.nome === 'gratuito' ? 'Comunidade' : p.nome === 'pro' ? 'Prioritário' : 'E-mail') },
]

const GRUPOS = ['Organização', 'IA', 'Relatórios', 'Avançado', 'Suporte']

function UpagradeModal({ plano, onClose }: { plano: PlanoEntitlements; onClose: () => void }) {
  const assunto = encodeURIComponent(`Quero assinar o plano ${plano.rotulo}`)
  const corpo = encodeURIComponent(
    `Olá! Quero assinar o plano ${plano.rotulo} do Equili (R$ ${plano.preco_mensal.toFixed(2).replace('.', ',')}/mês).`
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Crown size={20} className="text-primary-500" />
            <h2 className="text-base font-bold text-gray-800">Assinar {plano.rotulo}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-600">
          O pagamento online (cartão/PIX) está <strong>em breve</strong>. Enquanto isso, assine falando
          com a gente — ativamos seu plano rapidinho:
        </p>
        <a
          href={`mailto:suporte@equili.app?subject=${assunto}&body=${corpo}`}
          className="btn-primary w-full inline-flex items-center justify-center gap-2"
        >
          <Mail size={16} />
          Solicitar por e-mail
        </a>
        <p className="text-xs text-gray-400 text-center">
          suporte@equili.app · resposta em até 1 dia útil
        </p>
      </div>
    </div>
  )
}

export default function PlanosPage() {
  const { data: catalogo, isLoading } = useQuery({
    queryKey: ['planos-catalogo'],
    queryFn: listarPlanos,
  })
  const { plano: planoAtual, rotulo } = usePlano()
  const [assinando, setAssinando] = useState<PlanoEntitlements | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    )
  }

  const planos = catalogo ?? []

  return (
    <div className="w-full mx-auto max-w-4xl p-4 space-y-6">
      <PageHeader title="Planos e assinaturas" subtitle={`Seu plano atual: ${rotulo}`} />

      {/* Cards de preço */}
      <div className="grid gap-4 md:grid-cols-3">
        {planos.map((plano) => {
          const ehAtual = plano.nome === planoAtual
          return (
            <div
              key={plano.nome}
              className="card p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">{plano.rotulo}</h3>
                {ehAtual && (
                  <span className="text-xs font-semibold text-primary-500 bg-primary-100 rounded-full px-2 py-0.5">
                    Seu plano
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 min-h-[40px]">{plano.descricao}</p>
              <div>
                <span className="text-2xl font-extrabold text-gray-800">{preco(plano.preco_mensal)}</span>
                {plano.preco_mensal > 0 && <span className="text-sm text-gray-500">/mês</span>}
                {plano.preco_anual > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {preco(plano.preco_anual)}/ano (2 meses grátis)
                  </p>
                )}
              </div>
              {ehAtual ? (
                <p className="btn-secondary w-full text-center cursor-default py-2.5 rounded-xl text-sm font-medium">
                  Plano atual
                </p>
              ) : (
                <button
                  onClick={() => setAssinando(plano)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Crown size={16} />
                  Assinar {plano.rotulo}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Comparativo */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="p-3 font-medium">Recurso</th>
              {planos.map((p) => (
                <th key={p.nome} className="p-3 font-semibold text-gray-700 whitespace-nowrap">
                  {p.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map((grupo) => (
              <Fragment key={grupo}>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                    {grupo}
                  </td>
                </tr>
                {LINHAS.filter((l) => l.grupo === grupo).map((linha) => (
                  <tr key={linha.rotulo} className="border-b border-gray-50">
                    <td className="p-3 text-gray-700">{linha.rotulo}</td>
                    {planos.map((p) => (
                      <td key={p.nome} className={`p-3 whitespace-nowrap ${p.nome === planoAtual ? 'text-primary-500 font-medium' : 'text-gray-600'}`}>
                        {linha.valor(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Pagamentos online em breve. Cancelamento quando quiser. Valores em reais (BRL).
      </p>

      <div className="text-center">
        <Link to="/" className="text-sm text-primary-500 hover:underline">
          Voltar ao app
        </Link>
      </div>

      {assinando && <UpagradeModal plano={assinando} onClose={() => setAssinando(null)} />}
    </div>
  )
}
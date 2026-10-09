import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'

interface PaywallProps {
  titulo?: string
  descricao?: string
}

/**
 * Bloco exibido no lugar de um recurso pago (Premium/Pro) para usuários
 * do plano Gratuito, com chamada para a página de planos.
 */
export default function Paywall({
  titulo = 'Recurso exclusivo',
  descricao = 'Este recurso está disponível nos planos Premium e Pro / Família.',
}: PaywallProps) {
  return (
    <div className="card p-8 text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
        <Lock size={24} className="text-primary-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-gray-800">{titulo}</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">{descricao}</p>
      </div>
      <Link
        to="/planos"
        className="btn-primary inline-flex items-center gap-2 justify-center"
      >
        Ver planos e fazer upgrade
      </Link>
      <p className="text-xs text-gray-400">
        Planos a partir de R$ 19,90/mês · cancele quando quiser
      </p>
    </div>
  )
}
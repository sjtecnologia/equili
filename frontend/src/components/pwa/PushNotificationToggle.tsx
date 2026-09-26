import { Bell, BellOff } from 'lucide-react'
import { usePushNotification } from '@/hooks/usePushNotification'

export default function PushNotificationToggle() {
  const { supported, permission, loading, subscribe, unsubscribe } = usePushNotification()

  if (!supported) return null

  const isGranted = permission === 'granted'

  return (
    <button
      onClick={isGranted ? unsubscribe : subscribe}
      disabled={loading || permission === 'denied'}
      title={permission === 'denied' ? 'Bloqueado no navegador' : isGranted ? 'Desativar alertas' : 'Ativar alertas de vencimento'}
      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${
        isGranted
          ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
          : permission === 'denied'
          ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
          : 'bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60'
      }`}
    >
      {isGranted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
      <span>{isGranted ? 'Alertas ativos' : 'Ativar alertas'}</span>
    </button>
  )
}

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

// Converte a VAPID public key de base64url para Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushNotificationToggle() {
  const token = useAuthStore((s) => s.accessToken)
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ok = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    setSupported(ok)
    if (ok) setPermission(Notification.permission)
  }, [])

  const subscribe = async () => {
    if (!token || loading) return
    setLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return

      const reg = await navigator.serviceWorker.ready

      // Busca a VAPID public key do backend
      const { data } = await api.get('/notificacoes/vapid-public-key', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key).buffer as ArrayBuffer,
      })

      await api.post(
        '/notificacoes/subscribe',
        { subscription: subscription.toJSON() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (err) {
      console.error('Erro ao ativar notificações:', err)
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    if (!token || loading) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await api.post(
          '/notificacoes/unsubscribe',
          { endpoint: sub.endpoint },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }
      setPermission('default')
    } catch (err) {
      console.error('Erro ao desativar notificações:', err)
    } finally {
      setLoading(false)
    }
  }

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

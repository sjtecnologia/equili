import { useEffect, useState } from 'react'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { notify } from '@/utils/notify'

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

export function usePushNotification() {
  const token = useAuthStore((s) => s.accessToken)
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ok =
      'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
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
      notify.error('Erro ao ativar notificações. Tente novamente.')
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
      notify.error('Erro ao desativar notificações. Tente novamente.')
      console.error('Erro ao desativar notificações:', err)
    } finally {
      setLoading(false)
    }
  }

  return { supported, permission, loading, subscribe, unsubscribe }
}

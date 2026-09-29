import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n';
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'
import { queryClient } from '@/lib/queryClient'

window.addEventListener('error', (ev) => console.error('[GLOBAL_ERROR]', ev.error))
window.addEventListener('unhandledrejection', (ev) => console.error('[UNHANDLED]', ev.reason))

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '14px', maxWidth: '360px' },
          }}
        />
      </QueryClientProvider>
    </React.StrictMode>,
  )
} catch (error) {
  console.error('[BOOT_ERROR]', error)
}

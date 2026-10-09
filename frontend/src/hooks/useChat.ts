import { useRef, useState } from 'react'
import api from '@/services/api'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    'Olá! Sou o assistente financeiro do Equili 👋\n\nPode me fazer qualquer pergunta sobre sua situação financeira. Tenho acesso aos seus dados em tempo real.',
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const send = async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText || loading) return

    const userMsg: ChatMessage = { role: 'user', content: userText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post('/chat', {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 429) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Você atingiu o limite de mensagens do chat IA deste mês no seu plano. Faça upgrade (menu Meu Plano) para continuar conversando sem limite.',
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Desculpe, não consegui processar sua pergunta agora. Tente novamente em instantes.',
          },
        ])
      }
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const reset = () => {
    setMessages([{ role: 'assistant', content: 'Conversa reiniciada. Como posso ajudar?' }])
    setInput('')
  }

  return { messages, input, setInput, loading, send, reset, inputRef }
}

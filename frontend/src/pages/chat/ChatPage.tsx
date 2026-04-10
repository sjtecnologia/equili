import { useEffect, useRef, useState } from 'react'
import { Send, Bot, User, Loader2, RefreshCw } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGESTOES = [
  'Quanto tenho a pagar esse mês?',
  'Qual minha próxima conta a vencer?',
  'Qual dívida devo priorizar?',
  'Qual meu saldo projetado nos próximos 30 dias?',
]

function format(text: string) {
  // Transforma quebras de linha em parágrafos e listas básicas
  return text.split('\n').map((line, i) => {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <li key={i} className="ml-4 list-disc">
          {line.slice(2)}
        </li>
      )
    }
    if (line.trim() === '') return <br key={i} />
    return <p key={i}>{line}</p>
  })
}

export default function ChatPage() {
  const token = useAuthStore((s) => s.accessToken)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Olá! Sou o assistente financeiro do Equili 👋\n\nPode me fazer qualquer pergunta sobre sua situação financeira. Tenho acesso aos seus dados em tempo real.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText || loading) return

    const userMsg: Message = { role: 'user', content: userText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { data } = await api.post(
        '/chat',
        {
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Desculpe, não consegui processar sua pergunta agora. Tente novamente em instantes.',
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const reset = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Conversa reiniciada. Como posso ajudar?',
      },
    ])
    setInput('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Assistente IA</h1>
          <p className="text-sm text-gray-500">Pergunte sobre suas finanças em linguagem natural</p>
        </div>
        <button
          onClick={reset}
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
          title="Nova conversa"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
        {/* Sugestões iniciais */}
        {messages.length === 1 && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-left text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-2 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'assistant' ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <Bot size={16} className="text-white" />
              ) : (
                <User size={16} className="text-gray-600" />
              )}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
              }`}
            >
              <div className={msg.role === 'assistant' ? 'space-y-1' : ''}>
                {msg.role === 'assistant' ? format(msg.content) : msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <Loader2 size={16} className="text-indigo-500 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex gap-2 items-end bg-white border border-gray-300 rounded-2xl px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition shadow-sm">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Pergunte sobre suas finanças..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none max-h-32 py-1"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-center">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  )
}

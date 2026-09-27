import { useMemo, useState } from 'react'
import { Mic, MicOff, HelpCircle, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSpeechCommands } from '@/hooks/useSpeechCommands'
import { VOICE_COMMANDS, type VoiceCommandDefinition } from '@/config/voiceCommands'

export default function VoiceAssistant() {
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)
  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(false)

  const handleCommand = (command: VoiceCommandDefinition) => {
    switch (command.action) {
      case 'navigate':
        if (command.target) {
          navigate(command.target)
          toast.success(`Abrindo ${command.description.toLowerCase()}.`)
        }
        break
      case 'goBack':
        navigate(-1)
        toast.success('Voltando para a tela anterior.')
        break
      case 'refresh':
        window.location.reload()
        break
      case 'scrollTop':
        window.scrollTo({ top: 0, behavior: 'smooth' })
        toast.success('Rolando para o topo da página.')
        break
      case 'help':
        setHelpOpen(true)
        toast.success('Lista de comandos aberta.')
        break
      case 'toast':
        toast.success(command.description)
        break
      default:
        toast.success(command.description)
    }

    if (voiceFeedbackEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(command.description)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }
  }

  const { supported, isListening, start, stop, feedback } = useSpeechCommands(VOICE_COMMANDS, handleCommand)

  const groupedCommands = useMemo(() => {
    return VOICE_COMMANDS.reduce<Record<string, VoiceCommandDefinition[]>>((acc, command) => {
      if (!acc[command.section]) acc[command.section] = []
      acc[command.section].push(command)
      return acc
    }, {})
  }, [])

  if (!supported) {
    return (
      <div className="fixed bottom-5 right-5 z-40 hidden md:block">
        <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 shadow-sm">
          Voz indisponível neste navegador
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (isListening ? stop() : start())}
        className={[
          'fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 border border-white/40',
          isListening ? 'bg-primary-500 scale-105' : 'bg-primary-600 hover:bg-primary-500',
        ].join(' ')}
        aria-label="Assistente de voz"
      >
        {isListening ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
      </button>

      <div className="pointer-events-none fixed bottom-20 right-5 z-40">
        {isListening && (
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md ring-1 ring-gray-200 backdrop-blur-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary-500" />
            Ouvindo...
          </div>
        )}
      </div>

      {feedback && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-40 w-[min(90vw,420px)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm text-gray-700 shadow-xl">
          {feedback}
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="text-primary-500" size={22} />
                <h2 className="text-lg font-bold text-gray-800">Comandos de voz</h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Fechar ajuda"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span className="flex items-center gap-2"><Sparkles size={16} className="text-primary-500" /> Voz opcional</span>
              <button
                type="button"
                onClick={() => setVoiceFeedbackEnabled((value) => !value)}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  voiceFeedbackEnabled ? 'bg-primary-500 text-white' : 'bg-white text-gray-700 border border-gray-200',
                ].join(' ')}
              >
                {voiceFeedbackEnabled ? 'Ativado' : 'Desativado'}
              </button>
            </div>

            <div className="space-y-5">
              {Object.entries(groupedCommands).map(([section, commandsForSection]) => (
                <div key={section}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{section}</h3>
                  <ul className="space-y-2">
                    {commandsForSection.map((command) => (
                      <li key={command.id ?? `${command.section}:${command.aliases[0]}`} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-sm font-medium text-gray-800">{command.description}</p>
                        <p className="text-xs text-gray-500">{command.aliases.join(' · ')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

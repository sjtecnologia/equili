import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoiceCommandDefinition } from '@/config/voiceCommands'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<
    ArrayLike<{ transcript: string; confidence?: number }> & { isFinal?: boolean }
  >
}

function normalizeSpeechText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function useSpeechCommands(
  commands: VoiceCommandDefinition[],
  onMatch?: (command: VoiceCommandDefinition) => void,
) {
  const [isListening, setIsListening] = useState(false)
  const [lastCommand, setLastCommand] = useState('')
  const [feedback, setFeedback] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const supported = typeof window !== 'undefined' && Boolean(
    (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike
    }).SpeechRecognition ||
      (window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructorLike
        webkitSpeechRecognition?: SpeechRecognitionConstructorLike
      }).webkitSpeechRecognition,
  )

  const start = useCallback(() => {
    if (!supported) {
      setFeedback('Reconhecimento de voz indisponível neste navegador.')
      return
    }

    const api = (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike
    })
    const RecognitionCtor = api.SpeechRecognition ?? api.webkitSpeechRecognition

    if (!RecognitionCtor) {
      setFeedback('Reconhecimento de voz indisponível neste navegador.')
      return
    }

    if (!recognitionRef.current) {
      const recognition = new RecognitionCtor()
      recognition.lang = 'pt-BR'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onerror = (event) => {
        const error = event.error ?? 'desconhecido'
        setFeedback(`Não foi possível ouvir. Motivo: ${error}.`)
      }

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? '')
          .join(' ')
          .trim()

        if (!transcript) return

        const candidate = normalizeSpeechText(transcript)
        const resultList = Array.from(event.results)
        const finalResult = resultList[resultList.length - 1] as
          | (ArrayLike<{ transcript: string; confidence?: number }> & { isFinal?: boolean })
          | undefined

        if (!finalResult || !finalResult[0]) return

        const isFinal = typeof finalResult.isFinal === 'boolean' ? finalResult.isFinal : false
        if (!finalResult[0].transcript || !isFinal) {
          setFeedback(`Ouvindo: ${finalResult[0].transcript}`)
          return
        }

        const matched = commands.find((command) =>
          command.aliases.some((alias) => {
            const normalizedAlias = normalizeSpeechText(alias)
            return normalizedAlias === candidate || candidate.includes(normalizedAlias)
          }),
        )

        if (matched) {
          setLastCommand(matched.aliases[0])
          setFeedback(`Comando reconhecido: ${matched.aliases[0]}`)
          onMatch?.(matched)
          return
        }

        setLastCommand('')
        setFeedback('Comando não reconhecido. Diga "ajuda" para ver os comandos.')
      }

      recognitionRef.current = recognition
    }

    recognitionRef.current.start()
  }, [commands, onMatch, supported])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  return {
    supported,
    isListening,
    start,
    stop,
    lastCommand,
    feedback,
    setFeedback,
  }
}

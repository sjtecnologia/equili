import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImageUp,
  Loader2,
  RefreshCcw,
} from 'lucide-react'
import { parseNfsQr, type NfsQrData } from '@/services/nfsQrParser'

interface NfsQrReaderProps {
  onScanSuccess: (data: NfsQrData) => void
}

export default function NfsQrReader({ onScanSuccess }: NfsQrReaderProps) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'processing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [manualQrText, setManualQrText] = useState('')
  const [cameraList, setCameraList] = useState<Array<{ id: string; label: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  const stopScanner = async () => {
    const instance = scannerRef.current
    if (!instance) return

    try {
      await instance.stop()
    } catch {
      // ignora stop em scanners não iniciados
    }

    try {
      await instance.clear()
    } catch {
      // ignora clear em scanners sem estado válido
    }

    scannerRef.current = null
  }

  const loadCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      const normalized = devices.map((device) => ({
        id: device.id,
        label: device.label || 'Câmera disponível',
      }))
      setCameraList(normalized)
      if (normalized.length > 0) {
        const preferred = normalized.find((device) => /back|rear|environment/i.test(device.label)) ?? normalized[0]
        setSelectedCameraId(preferred.id)
      }
      return normalized
    } catch {
      setCameraList([])
      setSelectedCameraId(null)
      return []
    }
  }

  const startScanner = async (cameraId?: string) => {
    await stopScanner()

    const currentCameras = cameraList.length > 0 ? cameraList : await loadCameras()
    if (currentCameras.length === 0) {
      setStatus('error')
      setMessage('Nenhuma câmera foi detectada neste dispositivo ou navegador.')
      return
    }

    const cameraIdToUse = cameraId ?? selectedCameraId ?? currentCameras[0].id
    const cameraVideoConstraints = {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ zoom: 2.2 }, { focusMode: 'continuous' }],
    } as MediaTrackConstraints & {
      advanced?: Array<Record<string, unknown>>
    }

    try {
      const scanner = new Html5Qrcode('nfs-reader')
      scannerRef.current = scanner
      setStatus('scanning')
      setMessage('Aguardando leitura do QR da nota...')

      await scanner.start(
        cameraIdToUse,
        {
          fps: 20,
          qrbox: {
            width: 180,
            height: 180,
          },
          aspectRatio: 1.777778,
          disableFlip: false,
          videoConstraints: cameraVideoConstraints,
        },
        async (decodedText) => {
          try {
            setStatus('processing')
            setMessage('Processando QR da nota...')
            const parsed = parseNfsQr(decodedText)
            onScanSuccess(parsed)
            setStatus('success')
            setMessage('QR da nota lido com sucesso.')
            await stopScanner()
          } catch (error) {
            const errMessage = error instanceof Error ? error.message : 'Não foi possível processar o QR da nota.'
            setStatus('error')
            setMessage(errMessage)
            await stopScanner()
          }
        },
        () => {
          // erros de leitura do QR são ignorados para manter o fluxo do scanner estável
        }
      )
    } catch {
      setStatus('error')
      setMessage('Não foi possível iniciar a câmera. Verifique a permissão do navegador.')
    }
  }

  const toggleCamera = async () => {
    if (cameraList.length < 2) {
      setStatus('error')
      setMessage('Apenas uma câmera foi detectada neste dispositivo.')
      return
    }

    const currentIndex = cameraList.findIndex((camera) => camera.id === selectedCameraId)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cameraList.length : 0
    const nextCameraId = cameraList[nextIndex].id
    setSelectedCameraId(nextCameraId)
    await startScanner(nextCameraId)
  }

  useEffect(() => {
    void loadCameras()

    return () => {
      void stopScanner()
    }
  }, [])

  const handleManualQr = () => {
    const value = manualQrText.trim()
    if (!value) {
      setStatus('error')
      setMessage('Cole o conteúdo do QR ou a URL da nota para continuar.')
      return
    }

    try {
      const parsed = parseNfsQr(value)
      onScanSuccess(parsed)
      setStatus('success')
      setMessage('QR informado processado com sucesso.')
      setManualQrText('')
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Não foi possível processar o QR informado.'
      setStatus('error')
      setMessage(`${errMessage} Tente uma imagem mais nítida do QR ou cole a URL/consulta da nota.`)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setStatus('processing')
    setMessage('Lendo QR da imagem enviada...')

    const fileScanner = new Html5Qrcode('nfs-upload-reader')

    try {
      const decodedText = await fileScanner.scanFile(file, false)
      const parsed = parseNfsQr(decodedText)
      onScanSuccess(parsed)
      setStatus('success')
      setMessage('QR da imagem processado com sucesso.')
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Não foi possível ler o QR da imagem.'
      setStatus('error')
      setMessage(`${errMessage} Tente aproximar a câmera, remover reflexo e usar uma imagem mais nítida. Também é possível colar o texto do QR manualmente abaixo.`)
    } finally {
      try {
        await fileScanner.clear()
      } catch {
        // ignora limpeza do scanner em caso de estado não inicializado
      }
      event.target.value = ''
    }
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Leitura de QR da nota</p>
          <p className="text-xs text-gray-500">Escaneie o QR ou envie a imagem da nota fiscal.</p>
        </div>
        {cameraList.length > 1 && (
          <button
            type="button"
            onClick={() => void toggleCamera()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw size={16} />
            Trocar câmera
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-3">
        <div id="nfs-reader" className="min-h-[240px] w-full overflow-hidden rounded-xl bg-black/5" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void startScanner()}
          disabled={status === 'processing' || status === 'scanning'}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          {status === 'scanning' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          Ler QR da nota
        </button>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ImageUp size={16} />
          Enviar imagem
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>

      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
          Ou cole o conteúdo do QR / URL da nota
        </label>
        <textarea
          value={manualQrText}
          onChange={(event) => setManualQrText(event.target.value)}
          rows={3}
          placeholder="https://... ou chave=...&numero=..."
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none ring-0 placeholder:text-gray-400 focus:border-primary-400"
        />
        <button
          type="button"
          onClick={handleManualQr}
          className="inline-flex items-center rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Processar QR informado
        </button>
      </div>

      {status !== 'idle' && (
        <div
          className={[
            'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
            status === 'success' && 'border-green-200 bg-green-50 text-green-700',
            status === 'error' && 'border-red-200 bg-red-50 text-red-700',
            status === 'processing' && 'border-blue-200 bg-blue-50 text-blue-700',
            status === 'scanning' && 'border-amber-200 bg-amber-50 text-amber-700',
          ].join(' ')}
        >
          {status === 'success' ? <CheckCircle2 size={18} /> : status === 'error' ? <AlertCircle size={18} /> : <Loader2 size={18} className="animate-spin" />}
          <span>{message}</span>
        </div>
      )}

      <div id="nfs-upload-reader" className="hidden" />
    </div>
  )
}

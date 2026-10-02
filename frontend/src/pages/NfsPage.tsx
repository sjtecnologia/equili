import { useEffect, useState } from 'react'
import { FileText, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import NfsQrReader from '@/components/nfs/NfsQrReader'
import api from '@/services/api'
import { formatCurrency } from '@/utils/format'
import { FiltrosBarra, limparFiltrosVazios, CAMPOS_PERIODO, type CampoFiltro } from '@/components/shared/FiltrosBarra'
import type { NfsQrData } from '@/services/nfsQrParser'

const CAMPOS_FILTRO: CampoFiltro[] = [
  { key: 'q', tipo: 'busca', placeholder: 'Buscar (número, série, chave ou CPF/CNPJ)' },
  { key: 'valor_min', tipo: 'numero', label: 'Valor mínimo', step: '0.01' },
  { key: 'valor_max', tipo: 'numero', label: 'Valor máximo', step: '0.01' },
  ...CAMPOS_PERIODO.map((c) => ({ ...c, label: c.key === 'data_inicio' ? 'Emissão de' : 'Emissão até' }) as CampoFiltro),
]

interface NfsNota {
  id: string
  numero: string
  serie: string | null
  valor: number | string
  chave_acesso: string
  codigo_verificacao?: string | null
  cpf_cnpj?: string | null
  inscricao_municipal?: string | null
  url_consulta?: string | null
  created_at?: string
}

export default function NfsPage() {
  const [dadosLidos, setDadosLidos] = useState<NfsQrData | null>(null)
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  })
  const [notas, setNotas] = useState<NfsNota[]>([])
  const [loading, setLoading] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [removendoId, setRemovendoId] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const temFiltro = Object.keys(filtros).length > 0

  const carregarNotas = async (params: Record<string, string> = filtros) => {
    setLoading(true)
    try {
      const { data } = await api.get('/nfs', { params })
      setNotas(data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar as notas fiscais.'
      setStatus({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  // Refaz a busca sempre que os filtros mudam
  useEffect(() => {
    void carregarNotas(filtros)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros])

  const handleLancarNota = async () => {
    if (!dadosLidos) {
      setStatus({ type: 'error', message: 'Leitura de QR necessária antes de lançar a nota.' })
      return
    }

    setEnviando(true)
    try {
      await api.post('/nfs', {
        numero: dadosLidos.numero,
        serie: dadosLidos.serie,
        valor: Number(dadosLidos.valor),
        chave_acesso: dadosLidos.chaveAcesso,
        codigo_verificacao: dadosLidos.codigoVerificacao,
        cpf_cnpj: dadosLidos.cpfCnpj,
        inscricao_municipal: dadosLidos.inscricaoMunicipal,
        url_consulta: dadosLidos.urlConsulta,
        data_emissao: new Date().toISOString(),
      })

      setStatus({ type: 'success', message: 'Nota fiscal lançada com sucesso.' })
      setDadosLidos(null)
      await carregarNotas()
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response
          ? String((error.response as { data?: { detail?: string } }).data?.detail ?? 'Não foi possível lançar a nota.')
          : 'Não foi possível lançar a nota.'
      setStatus({ type: 'error', message })
    } finally {
      setEnviando(false)
    }
  }

  const handleDelete = async (id: string) => {
    setRemovendoId(id)
    try {
      await api.delete(`/nfs/${id}`)
      setStatus({ type: 'success', message: 'Nota removida com sucesso.' })
      await carregarNotas()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível remover a nota.'
      setStatus({ type: 'error', message })
    } finally {
      setRemovendoId(null)
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title="Notas Fiscais (NFS)"
        subtitle="Leia o QR da nota e registre as informações no sistema."
      />

      <NfsQrReader onScanSuccess={setDadosLidos} />

      {dadosLidos && (
        <div className="card border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-800">Resumo da NFC-e lida</p>
              <p className="text-xs text-emerald-700">Revise os dados antes de lançar a nota.</p>
            </div>
            <button
              type="button"
              onClick={handleLancarNota}
              disabled={enviando}
              className="btn-primary disabled:opacity-60"
            >
              {enviando ? 'Lançando...' : 'Lançar nota'}
            </button>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Valor</p>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(dadosLidos.valor)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs uppercase tracking-wide text-gray-500">Nota</p>
                <p className="text-lg font-semibold text-gray-800">{dadosLidos.numero} · Série {dadosLidos.serie}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">Chave de acesso</p>
              <p className="mt-1 font-semibold text-gray-800 break-all">{dadosLidos.chaveAcesso}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">Código verificação</p>
              <p className="mt-1 font-semibold text-gray-800">{dadosLidos.codigoVerificacao}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">CPF/CNPJ</p>
              <p className="mt-1 font-semibold text-gray-800">{dadosLidos.cpfCnpj}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">Inscrição municipal</p>
              <p className="mt-1 font-semibold text-gray-800">{dadosLidos.inscricaoMunicipal}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 md:col-span-2">
              <p className="text-xs text-gray-500">URL de consulta</p>
              <p className="mt-1 font-semibold text-gray-800 break-all">{dadosLidos.urlConsulta}</p>
            </div>
          </div>
        </div>
      )}

      {status.type !== 'idle' && (
        <div
          className={[
            'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
            status.type === 'success' && 'border-green-200 bg-green-50 text-green-700',
            status.type === 'error' && 'border-red-200 bg-red-50 text-red-700',
          ].join(' ')}
        >
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{status.message}</span>
        </div>
      )}

      <FiltrosBarra campos={CAMPOS_FILTRO} onFiltrar={(f) => setFiltros(limparFiltrosVazios(f))} />

      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Notas já lançadas</p>
            <p className="text-xs text-gray-500">Últimas notas cadastradas por você.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{notas.length}</span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
            Carregando notas...
          </div>
        ) : notas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <FileText className="mx-auto mb-3 text-gray-300" size={28} />
            <p className="text-sm font-medium text-gray-600">{temFiltro ? 'Nenhuma nota encontrada para os filtros informados.' : 'Nenhuma nota lançada ainda.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notas.map((nota) => (
              <div key={nota.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    NF {nota.numero} · Série {nota.serie || '001'}
                  </p>
                  <p className="text-xs text-gray-500 break-all">{nota.chave_acesso}</p>
                  <p className="mt-1 text-xs text-gray-500">{nota.codigo_verificacao || 'Sem código'} · {formatCurrency(Number(nota.valor) || 0)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(nota.id)}
                  disabled={removendoId === nota.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  {removendoId === nota.id ? 'Removendo...' : 'Excluir'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

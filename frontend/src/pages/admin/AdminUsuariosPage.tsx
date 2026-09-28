import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { atualizarPlanoAdmin, listarUsuariosAdmin } from '@/services/api'
import { parseApiError } from '@/utils/api'

type UsuarioAdmin = {
  id: string
  nome: string
  email: string
  plano: string
  ativo: boolean
}

const planos = ['gratuito', 'premium', 'pro']

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [planosSelecionados, setPlanosSelecionados] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  useEffect(() => {
    listarUsuariosAdmin()
      .then((data) => {
        setUsuarios(data)
        setPlanosSelecionados(Object.fromEntries(data.map((u: UsuarioAdmin) => [u.id, u.plano])))
      })
      .catch((err) => setErro(parseApiError(err) ?? 'Não foi possível carregar os usuários.'))
      .finally(() => setLoading(false))
  }, [])

  async function salvar(usuario: UsuarioAdmin) {
    setSalvando(usuario.id)
    setFeedback((atual) => ({ ...atual, [usuario.id]: '' }))
    try {
      const plano = planosSelecionados[usuario.id]
      await atualizarPlanoAdmin(usuario.id, plano)
      setUsuarios((atuais) => atuais.map((u) => (u.id === usuario.id ? { ...u, plano } : u)))
      setFeedback((atual) => ({ ...atual, [usuario.id]: 'Plano atualizado com sucesso.' }))
    } catch (err) {
      setFeedback((atual) => ({ ...atual, [usuario.id]: parseApiError(err) ?? 'Erro ao atualizar o plano.' }))
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gerenciar Planos" />
      <section className="card overflow-hidden">
        {loading && <div className="p-6 text-sm text-gray-500">Carregando usuários...</div>}
        {erro && <div className="p-6 text-sm text-danger-500">{erro}</div>}
        {!loading && !erro && usuarios.length === 0 && (
          <div className="p-6 text-sm text-gray-500">Nenhum usuário encontrado.</div>
        )}
        {!loading && !erro && usuarios.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Nome</th>
                  <th className="px-6 py-3 font-medium">E-mail</th>
                  <th className="px-6 py-3 font-medium">Plano atual</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td className="px-6 py-4 text-gray-800">{usuario.nome}</td>
                    <td className="px-6 py-4 text-gray-600">{usuario.email}</td>
                    <td className="px-6 py-4">
                      <select
                        className="input-field w-auto"
                        value={planosSelecionados[usuario.id] ?? usuario.plano}
                        onChange={(e) => setPlanosSelecionados((atual) => ({ ...atual, [usuario.id]: e.target.value }))}
                      >
                        {planos.map((plano) => <option key={plano} value={plano}>{plano}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{usuario.ativo ? 'Ativo' : 'Inativo'}</td>
                    <td className="px-6 py-4">
                      <button className="btn-primary flex items-center gap-2" disabled={salvando === usuario.id} onClick={() => salvar(usuario)}>
                        {salvando === usuario.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Salvar
                      </button>
                      {feedback[usuario.id] && <p className="mt-1 text-xs text-gray-500">{feedback[usuario.id]}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

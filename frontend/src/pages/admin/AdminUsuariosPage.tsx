import { useEffect, useState } from 'react'
import { Loader2, Power, Save, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { atualizarPlanoAdmin, excluirUsuario, listarUsuariosAdmin, toggleUsuarioAtivo } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import type { UsuarioAdmin } from '@/types/financeiro'
import { parseApiError } from '@/utils/api'

const planos = ['gratuito', 'premium', 'pro']

export default function AdminUsuariosPage() {
  const usuarioLogado = useAuthStore((state) => state.user)
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [planosSelecionados, setPlanosSelecionados] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [alterandoStatus, setAlterandoStatus] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  async function carregarUsuarios() {
    setLoading(true)
    setErro(null)
    try {
      const data = await listarUsuariosAdmin()
      setUsuarios(data)
      setPlanosSelecionados(Object.fromEntries(data.map((u) => [u.id, u.plano])))
    } catch (err) {
      setErro(parseApiError(err) ?? 'Não foi possível carregar os usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarUsuarios()
  }, [])

  async function recarregarUsuarios() {
    try {
      const data = await listarUsuariosAdmin()
      setUsuarios(data)
      setPlanosSelecionados(Object.fromEntries(data.map((u) => [u.id, u.plano])))
    } catch (err) {
      setErro(parseApiError(err) ?? 'Não foi possível atualizar a lista de usuários.')
    }
  }

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

  async function alterarStatus(usuario: UsuarioAdmin) {
    const proximoAtivo = !usuario.ativo
    const acao = proximoAtivo ? 'reativar' : 'desativar'
    const confirmado = window.confirm(`Tem certeza que deseja ${acao} o usuário ${usuario.nome}?`)
    if (!confirmado) return

    setAlterandoStatus(usuario.id)
    setFeedback((atual) => ({ ...atual, [usuario.id]: '' }))
    try {
      await toggleUsuarioAtivo(usuario.id, proximoAtivo)
      await recarregarUsuarios()
      setFeedback((atual) => ({
        ...atual,
        [usuario.id]: proximoAtivo ? 'Usuário reativado com sucesso.' : 'Usuário desativado com sucesso.',
      }))
    } catch (err) {
      setFeedback((atual) => ({ ...atual, [usuario.id]: parseApiError(err) ?? 'Erro ao alterar o status.' }))
    } finally {
      setAlterandoStatus(null)
    }
  }

  async function excluir(usuario: UsuarioAdmin) {
    const confirmado = window.confirm(
      `Tem certeza que deseja excluir o usuário ${usuario.nome}? Esta ação apaga os dados do usuário e não pode ser desfeita.`
    )
    if (!confirmado) return

    setExcluindo(usuario.id)
    setFeedback((atual) => ({ ...atual, [usuario.id]: '' }))
    try {
      await excluirUsuario(usuario.id)
      await recarregarUsuarios()
    } catch (err) {
      setFeedback((atual) => ({ ...atual, [usuario.id]: parseApiError(err) ?? 'Erro ao excluir o usuário.' }))
    } finally {
      setExcluindo(null)
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
                  <th className="px-6 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuarios.map((usuario) => {
                  const isUsuarioLogado = usuario.id === usuarioLogado?.id
                  return (
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
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${usuario.ativo ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-600'}`}>
                          {usuario.ativo ? 'Ativo' : 'Desativado'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button className="btn-primary flex items-center gap-2" disabled={salvando === usuario.id} onClick={() => salvar(usuario)}>
                            {salvando === usuario.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Salvar
                          </button>
                          {!isUsuarioLogado && (
                            <>
                              <button className="btn-secondary flex items-center gap-2" disabled={alterandoStatus === usuario.id} onClick={() => alterarStatus(usuario)}>
                                {alterandoStatus === usuario.id ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                                {usuario.ativo ? 'Desativar' : 'Reativar'}
                              </button>
                              <button
                                className="flex items-center gap-2 rounded bg-danger-500 px-6 py-3 font-semibold text-white transition-colors duration-150 hover:bg-danger-600 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={excluindo === usuario.id}
                                onClick={() => excluir(usuario)}
                              >
                                {excluindo === usuario.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Excluir
                              </button>
                            </>
                          )}
                        </div>
                        {feedback[usuario.id] && <p className="mt-1 text-xs text-gray-500">{feedback[usuario.id]}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

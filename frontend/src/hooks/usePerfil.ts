import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

export function usePerfil() {
  const setUser = useAuthStore((s) => s.setUser)

  async function salvarPerfil(data: { nome: string; email: string }) {
    const res = await api.put('/usuarios/me', data)
    setUser(res.data)
  }

  async function alterarSenha(data: { senha_atual: string; nova_senha: string }) {
    await api.put('/usuarios/me', {
      senha_atual: data.senha_atual,
      nova_senha: data.nova_senha,
    })
  }

  async function exportarDados() {
    const { data } = await api.get('/usuarios/me/exportar-dados')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `equili-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function excluirConta(senha: string, confirmacao: string) {
    await api.delete('/usuarios/me', { data: { senha, confirmacao } })
  }

  return { salvarPerfil, alterarSenha, exportarDados, excluirConta }
}

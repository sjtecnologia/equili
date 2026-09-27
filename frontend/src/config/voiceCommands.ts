export type VoiceCommandAction =
  | 'navigate'
  | 'goBack'
  | 'refresh'
  | 'scrollTop'
  | 'help'
  | 'toast'

export interface VoiceCommandDefinition {
  id?: string
  section: string
  description: string
  aliases: string[]
  action: VoiceCommandAction
  target?: string
}

export const VOICE_COMMANDS: VoiceCommandDefinition[] = [
  { section: 'Geral', description: 'Abrir painel principal', aliases: ['ir para dashboard', 'abrir dashboard', 'dashboard', 'painel'], action: 'navigate', target: '/dashboard' },
  { section: 'Geral', description: 'Voltar para a tela anterior', aliases: ['voltar', 'volta', 'retroceder'], action: 'goBack' },
  { section: 'Geral', description: 'Atualizar a página', aliases: ['atualizar página', 'recarregar', 'atualizar'], action: 'refresh' },
  { section: 'Geral', description: 'Rolar até o topo', aliases: ['rolar para o topo', 'topo da página', 'voltar ao topo'], action: 'scrollTop' },
  { section: 'Geral', description: 'Abrir ajuda de comandos', aliases: ['ajuda', 'mostrar comandos', 'comandos de voz'], action: 'help' },

  { section: 'Renda', description: 'Abrir renda', aliases: ['ir para renda', 'abrir renda', 'renda', 'receitas'], action: 'navigate', target: '/renda' },
  { section: 'Renda', description: 'Adicionar renda', aliases: ['nova renda', 'adicionar renda', 'incluir renda'], action: 'toast', target: '/renda' },

  { section: 'Dívidas', description: 'Abrir dívidas', aliases: ['ir para dívidas', 'abrir dívidas', 'dividas', 'dívidas'], action: 'navigate', target: '/dividas' },
  { section: 'Dívidas', description: 'Abrir baixas de dívidas', aliases: ['ir para baixas de dívidas', 'abrir baixas de dívidas', 'baixas de dívidas'], action: 'navigate', target: '/dividas/baixas' },
  { section: 'Dívidas', description: 'Adicionar dívida', aliases: ['nova dívida', 'adicionar dívida', 'incluir dívida'], action: 'toast' },
  { section: 'Dívidas', description: 'Registrar pagamento', aliases: ['registrar pagamento', 'pagar dívida'], action: 'toast' },

  { section: 'Contas a pagar', description: 'Abrir contas a pagar', aliases: ['ir para contas a pagar', 'abrir contas a pagar', 'contas a pagar', 'despesas'], action: 'navigate', target: '/contas-pagar' },
  { section: 'Contas a pagar', description: 'Adicionar conta', aliases: ['nova conta', 'adicionar conta', 'incluir conta a pagar'], action: 'toast' },

  { section: 'Contas a receber', description: 'Abrir contas a receber', aliases: ['ir para contas a receber', 'abrir contas a receber', 'contas a receber', 'receitas futuras'], action: 'navigate', target: '/contas-receber' },
  { section: 'Contas a receber', description: 'Adicionar recebimento', aliases: ['novo recebimento', 'adicionar recebimento', 'receber conta'], action: 'toast' },

  { section: 'Contas e cartões', description: 'Abrir contas e cartões', aliases: ['ir para contas e cartões', 'abrir contas e cartões', 'contas bancárias', 'contas bancarias', 'cartões'], action: 'navigate', target: '/contas-bancarias' },
  { section: 'Contas e cartões', description: 'Nova conta', aliases: ['nova conta bancária', 'adicionar conta bancária', 'novo cartão'], action: 'toast' },
  { section: 'Contas e cartões', description: 'Sincronizar dados', aliases: ['sincronizar agora', 'atualizar contas'], action: 'toast' },

  { section: 'Relatórios', description: 'Abrir relatórios', aliases: ['ir para relatórios', 'abrir relatórios', 'relatórios', 'relatorio'], action: 'navigate', target: '/relatorios' },
  { section: 'Relatórios', description: 'Aplicar filtro', aliases: ['aplicar filtro', 'filtrar relatório', 'filtrar'], action: 'toast' },
  { section: 'Relatórios', description: 'Limpar filtros', aliases: ['limpar filtros', 'limpar relatório'], action: 'toast' },

  { section: 'Plano de ação', description: 'Abrir plano de ação', aliases: ['ir para plano de ação', 'abrir plano de ação', 'plano de ação', 'plano'], action: 'navigate', target: '/plano-de-acao' },
  { section: 'Plano de ação', description: 'Gerar nova meta', aliases: ['nova meta', 'gerar plano', 'criar plano'], action: 'toast' },

  { section: 'Assistente IA', description: 'Abrir assistente IA', aliases: ['ir para assistente ia', 'abrir assistente ia', 'assistente ia', 'chat', 'assistente'], action: 'navigate', target: '/chat' },
  { section: 'Assistente IA', description: 'Nova conversa', aliases: ['nova conversa', 'limpar conversa'], action: 'toast' },

  { section: 'Investimentos', description: 'Abrir investimentos', aliases: ['ir para investimentos', 'abrir investimentos', 'investimentos', 'carteira'], action: 'navigate', target: '/investimentos' },
  { section: 'Investimentos', description: 'Adicionar investimento', aliases: ['novo investimento', 'adicionar investimento'], action: 'toast' },

  { section: 'Listas', description: 'Abrir listas', aliases: ['ir para listas', 'abrir listas', 'listas', 'afazeres', 'compras'], action: 'navigate', target: '/listas' },
  { section: 'Listas', description: 'Nova tarefa', aliases: ['nova tarefa', 'adicionar tarefa'], action: 'toast' },
  { section: 'Listas', description: 'Nova compra', aliases: ['nova compra', 'adicionar compra'], action: 'toast' },

  { section: 'Notas Fiscais', description: 'Abrir notas fiscais', aliases: ['ir para notas fiscais', 'abrir notas fiscais', 'notas fiscais', 'nfs'], action: 'navigate', target: '/nfs' },
  { section: 'Notas Fiscais', description: 'Ler QR da nota', aliases: ['ler nota', 'ler qr da nota', 'scan da nota'], action: 'toast' },
  { section: 'Notas Fiscais', description: 'Lançar nota', aliases: ['lançar nota', 'novo lançamento de nota'], action: 'toast' },

  { section: 'Configurações', description: 'Abrir configurações', aliases: ['ir para configurações', 'abrir configurações', 'configurações', 'configuracao'], action: 'navigate', target: '/configuracoes' },
  { section: 'Configurações', description: 'Salvar preferências', aliases: ['salvar configurações', 'salvar preferências'], action: 'toast' },
]

export const VOICE_COMMAND_GROUPS = Array.from(
  new Map(VOICE_COMMANDS.map((command) => [command.section, command.section])).entries()
).map(([, section]) => section)

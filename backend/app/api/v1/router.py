from fastapi import APIRouter

from app.api.v1.routes import (
    auth,
    usuarios,
    rendas,
    dividas,
    plano_acao,
    dashboard,
    contas_pagar,
    contas_receber,
    relatorio,
    notificacoes,
    chat,
    investimentos,
    voz,
    contas_bancarias,
    cartoes_credito,
    lancamentos_conta,
    lancamentos_cartao,
    listas,
    nfs,
    categorias,
    planos,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(usuarios.router, prefix="/usuarios", tags=["Usuários"])
api_router.include_router(rendas.router, prefix="/rendas", tags=["Renda"])
api_router.include_router(dividas.router, prefix="/dividas", tags=["Dívidas"])
api_router.include_router(contas_pagar.router, prefix="/contas-pagar", tags=["Contas a Pagar"])
api_router.include_router(contas_receber.router, prefix="/contas-receber", tags=["Contas a Receber"])
api_router.include_router(plano_acao.router, prefix="/plano-acao", tags=["Plano de Ação IA"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(relatorio.router, prefix="/relatorio", tags=["Relatórios"])
api_router.include_router(notificacoes.router, tags=["Notificações Push"])
api_router.include_router(chat.router, tags=["Chat IA"])
api_router.include_router(voz.router, tags=["Assistente de Voz"])
api_router.include_router(investimentos.router)
api_router.include_router(contas_bancarias.router, prefix="/contas-bancarias", tags=["Contas Bancárias"])
api_router.include_router(cartoes_credito.router, prefix="/cartoes-credito", tags=["Cartões de Crédito"])
api_router.include_router(lancamentos_conta.router, prefix="/contas-bancarias", tags=["Lançamentos Conta"])
api_router.include_router(lancamentos_cartao.router, prefix="/cartoes-credito", tags=["Lançamentos Cartão"])
api_router.include_router(listas.router, prefix="/listas", tags=["Listas"])
api_router.include_router(nfs.router, prefix="/nfs", tags=["Notas Fiscais"])
api_router.include_router(categorias.router, prefix="/categorias", tags=["Categorias"])
api_router.include_router(planos.router)

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

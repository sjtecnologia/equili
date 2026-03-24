from fastapi import APIRouter

from app.api.v1.routes import auth, usuarios, rendas, dividas, plano_acao, dashboard

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(usuarios.router, prefix="/usuarios", tags=["Usuários"])
api_router.include_router(rendas.router, prefix="/rendas", tags=["Renda"])
api_router.include_router(dividas.router, prefix="/dividas", tags=["Dívidas"])
api_router.include_router(plano_acao.router, prefix="/plano-acao", tags=["Plano de Ação IA"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

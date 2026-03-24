from fastapi import APIRouter, Cookie, HTTPException, Response, status
from sqlalchemy import select

from app.core.dependencies import DBSession
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter()

REFRESH_COOKIE = "refresh_token"


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: DBSession):
    # Verificar email duplicado
    result = await db.execute(select(Usuario).where(Usuario.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email já cadastrado.")

    usuario = Usuario(
        nome=data.nome,
        email=data.email,
        senha_hash=get_password_hash(data.senha),
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)
    return {"mensagem": "Cadastro realizado com sucesso."}


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, response: Response, db: DBSession):
    result = await db.execute(select(Usuario).where(Usuario.email == data.email))
    usuario = result.scalar_one_or_none()

    # Mensagem genérica para não revelar se email existe
    if not usuario or not verify_password(data.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos.",
        )

    if not usuario.ativo:
        raise HTTPException(status_code=403, detail="Conta desativada.")

    access_token = create_access_token(str(usuario.id))
    refresh_token = create_refresh_token(str(usuario.id))

    # Refresh token em httpOnly cookie
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=False,  # True em produção (HTTPS)
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )

    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    db: DBSession,
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token não encontrado.")
    payload = decode_token(refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token inválido.")

    usuario_id = payload.get("sub")
    usuario = await db.get(Usuario, usuario_id)

    if not usuario or not usuario.ativo:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")

    access_token = create_access_token(str(usuario.id))
    new_refresh = create_refresh_token(str(usuario.id))

    response.set_cookie(
        key=REFRESH_COOKIE,
        value=new_refresh,
        httponly=True,
        secure=False,  # True em produção (HTTPS)
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )

    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    response.delete_cookie(REFRESH_COOKIE)

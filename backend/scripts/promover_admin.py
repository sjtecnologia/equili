import asyncio
import sys

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.usuario import Usuario


async def main() -> None:
    email = sys.argv[1] if len(sys.argv) > 1 else input("E-mail do usuário: ").strip()
    async with AsyncSessionLocal() as db:
        usuario = await db.scalar(select(Usuario).where(Usuario.email == email))
        if not usuario:
            raise SystemExit("Usuário não encontrado.")
        usuario.is_admin = True
        await db.commit()
        print(f"Usuário {usuario.email} promovido a administrador.")


if __name__ == "__main__":
    asyncio.run(main())

from sqlalchemy import ColumnElement


def contem(coluna, termo: str) -> ColumnElement[bool]:
    """ILIKE '%termo%' com %, _ e \\ do termo escapados."""
    escaped = termo.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return coluna.ilike(f"%{escaped}%", escape="\\")

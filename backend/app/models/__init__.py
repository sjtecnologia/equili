from app.db.base import Base  # noqa: F401 — importado para Alembic detectar os modelos

from app.models.usuario import Usuario  # noqa: F401
from app.models.renda import Renda  # noqa: F401
from app.models.divida import Divida, DividaPagamento  # noqa: F401
from app.models.plano_acao import PlanoAcao  # noqa: F401
from app.models.conta import ContaFixa, Alerta  # noqa: F401
from app.models.conta_lancamento import ContaAPagar, ContaAReceber  # noqa: F401
from app.models.push_subscription import PushSubscription  # noqa: F401

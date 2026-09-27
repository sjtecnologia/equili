from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import jwt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/equili_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.api.v1.routes.auth import _is_session_valid_for_refresh
from app.core.config import settings
from app.core.security import create_refresh_token, decode_token, get_refresh_jti


def test_refresh_token_includes_jti_and_decodes() -> None:
    token = create_refresh_token("user-123")
    payload = decode_token(token)

    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["type"] == "refresh"
    assert payload["jti"]
    assert get_refresh_jti(token) == payload["jti"]


def test_legacy_refresh_without_jti_is_rejected() -> None:
    token = jwt.encode(
        {
            "sub": "user-123",
            "type": "refresh",
            "exp": datetime.now(timezone.utc) + timedelta(days=1),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )

    assert get_refresh_jti(token) is None


def test_session_validation_rejects_revoked_and_expired() -> None:
    usuario_id = uuid4()
    agora = datetime.now(timezone.utc)

    active = SimpleNamespace(
        usuario_id=usuario_id,
        revogada_em=None,
        expira_em=agora + timedelta(days=7),
    )
    revoked = SimpleNamespace(
        usuario_id=usuario_id,
        revogada_em=agora,
        expira_em=agora + timedelta(days=7),
    )
    expired = SimpleNamespace(
        usuario_id=usuario_id,
        revogada_em=None,
        expira_em=agora - timedelta(minutes=1),
    )

    assert _is_session_valid_for_refresh(active, usuario_id, agora) is True
    assert _is_session_valid_for_refresh(revoked, usuario_id, agora) is False
    assert _is_session_valid_for_refresh(expired, usuario_id, agora) is False
    assert _is_session_valid_for_refresh(None, usuario_id, agora) is False
    assert _is_session_valid_for_refresh(active, uuid4(), agora) is False

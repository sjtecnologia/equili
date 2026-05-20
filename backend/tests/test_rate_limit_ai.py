from collections import defaultdict
from pathlib import Path
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/equili_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app import main as main_module


class _DummyScheduler:
    def shutdown(self, wait: bool = False):
        return None


class _FakeRedis:
    def __init__(self):
        self._counters: dict[str, int] = {}
        self.expire_calls: list[tuple[str, int]] = []

    async def incr(self, key: str) -> int:
        self._counters[key] = self._counters.get(key, 0) + 1
        return self._counters[key]

    async def expire(self, key: str, ttl: int) -> bool:
        self.expire_calls.append((key, ttl))
        return True

    async def aclose(self) -> None:
        return None


def _prepare_app(limit: int = 2, window: int = 60):
    main_module._run_migrations = lambda: None
    main_module.start_scheduler = lambda: _DummyScheduler()
    main_module.settings.RATE_LIMIT_AI_REQUESTS = limit
    main_module.settings.RATE_LIMIT_AI_WINDOW_SECONDS = window


def test_ai_rate_limit_in_memory_fallback() -> None:
    _prepare_app(limit=2, window=7)
    main_module._redis_client = None
    main_module._rate_cache_ai = defaultdict(list)

    with TestClient(main_module.app) as client:
        r1 = client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "oi"}]})
        r2 = client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "oi"}]})
        r3 = client.post("/api/v1/chat", json={"messages": [{"role": "user", "content": "oi"}]})

    assert r1.status_code != 429
    assert r2.status_code != 429
    assert r3.status_code == 429
    assert r3.headers.get("Retry-After") == "7"


def test_ai_rate_limit_with_redis_counter() -> None:
    _prepare_app(limit=2, window=9)
    fake_redis = _FakeRedis()
    main_module._redis_client = fake_redis
    main_module._rate_cache_ai = defaultdict(list)

    with TestClient(main_module.app) as client:
        r1 = client.post("/api/v1/voz/comando", json={"transcricao": "adicionar conta de luz"})
        r2 = client.post("/api/v1/voz/comando", json={"transcricao": "adicionar conta de luz"})
        r3 = client.post("/api/v1/voz/comando", json={"transcricao": "adicionar conta de luz"})

    assert r1.status_code != 429
    assert r2.status_code != 429
    assert r3.status_code == 429
    assert r3.headers.get("Retry-After") == "9"
    # TTL da chave Redis precisa ser janela + 1 para limpeza automática.
    assert fake_redis.expire_calls, "Esperava ao menos uma chamada expire no Redis"
    assert fake_redis.expire_calls[0][1] == 10

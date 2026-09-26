import logging
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _slug_or_default(value: str, default_value: str) -> str:
    normalized = (value or "").strip()
    return normalized or default_value


class RastroClient:
    def __init__(self) -> None:
        self.enabled = bool(settings.RASTRO_ENABLED)
        self.ingest_url = settings.RASTRO_INGEST_URL
        self.ingest_token = settings.RASTRO_INGEST_TOKEN
        self.organization_slug = _slug_or_default(settings.RASTRO_ORGANIZATION_SLUG, "acme")
        self.project_slug = _slug_or_default(settings.RASTRO_PROJECT_SLUG, "equili")
        self.environment = _slug_or_default(settings.RASTRO_ENVIRONMENT, "development")
        self.release = _slug_or_default(settings.RASTRO_RELEASE, "dev")

    def is_ready(self) -> bool:
        return self.enabled and bool(self.ingest_url) and bool(self.ingest_token)

    async def send_event(
        self,
        *,
        message: str,
        fingerprint: str,
        level: str = "error",
        event_type: str = "error_event_v1",
        trace_id: str | None = None,
        span_id: str | None = None,
    ) -> None:
        if not self.is_ready():
            return

        payload = {
            "type": event_type,
            "organizationSlug": self.organization_slug,
            "projectSlug": self.project_slug,
            "environment": self.environment,
            "release": self.release,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "message": message,
            "fingerprint": fingerprint,
            "level": level,
        }

        if trace_id:
            payload["traceId"] = trace_id
        if span_id:
            payload["spanId"] = span_id

        headers = {
            "content-type": "application/json",
            "x-ingest-token": self.ingest_token,
        }

        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                response = await client.post(self.ingest_url, json=payload, headers=headers)
                if response.status_code >= 400:
                    logger.warning("[rastro] falha ingestao status=%s body=%s", response.status_code, response.text)
        except Exception as exc:
            logger.warning("[rastro] erro ao enviar evento: %s", exc)

    async def send_error_event(
        self,
        *,
        message: str,
        fingerprint: str,
        level: str = "error",
        trace_id: str | None = None,
        span_id: str | None = None,
    ) -> None:
        await self.send_event(
            message=message,
            fingerprint=fingerprint,
            level=level,
            event_type="error_event_v1",
            trace_id=trace_id,
            span_id=span_id,
        )

    async def send_warning_event(
        self,
        *,
        message: str,
        fingerprint: str,
        trace_id: str | None = None,
        span_id: str | None = None,
    ) -> None:
        await self.send_event(
            message=message,
            fingerprint=fingerprint,
            level="warning",
            event_type="error_event_v1",
            trace_id=trace_id,
            span_id=span_id,
        )


rastro_client = RastroClient()

"""Cliente central para o GitHub Models (https://models.github.ai/) — API compatível com OpenAI.

Usado pelo gerador de Plano de Ação e pelo Assistente IA (chat).
"""
import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

FALLBACK_MODEL = "openai/gpt-4o-mini"
RETRYABLE_STATUS_CODES = {429, 503}
RETRY_DELAYS_SECONDS = (1, 2)


class GitHubModelsNotConfigured(Exception):
    """Levantado quando GITHUB_MODELS_API_KEY (ou GITHUB_TOKEN) não está configurado."""


def get_github_models_config() -> tuple[str, str, str]:
    """Lê base_url, api_key e model das variáveis de ambiente."""
    base_url = settings.GITHUB_MODELS_BASE_URL.rstrip("/")
    api_key = settings.GITHUB_MODELS_API_KEY
    model = settings.GITHUB_MODELS_CHAT_MODEL or FALLBACK_MODEL
    if not api_key:
        logger.warning("GitHub Models não configurado — GITHUB_MODELS_API_KEY ausente.")
    return base_url, api_key, model


async def _chamar_github_models_raw(
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    response_format: dict | None,
    timeout: float = 30.0,
) -> dict:
    """Faz a chamada HTTP em si e retorna o corpo JSON bruto da resposta.

    Trata httpx.TimeoutException com retry e levanta TimeoutError após timeouts esgotados.
    Levanta httpx.HTTPStatusError em erro HTTP.
    """
    base_url, api_key, model = get_github_models_config()
    if not api_key:
        raise GitHubModelsNotConfigured(
            "GitHub Models não configurado — defina GITHUB_MODELS_API_KEY."
        )

    payload: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        payload["response_format"] = response_format

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    for tentativa in range(len(RETRY_DELAYS_SECONDS) + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
            response.raise_for_status()
            try:
                return response.json()
            except ValueError as exc:
                logger.error("Resposta não-JSON do GitHub Models.")
                raise ValueError("Resposta inválida do GitHub Models.") from exc
        except httpx.TimeoutException:
            if tentativa < len(RETRY_DELAYS_SECONDS):
                delay = RETRY_DELAYS_SECONDS[tentativa]
                logger.warning(
                    "Timeout ao chamar GitHub Models (tentativa %s/3) — aguardando %ss",
                    tentativa + 1,
                    delay,
                )
                await asyncio.sleep(delay)
                continue

            logger.error("Timeout ao chamar GitHub Models após todas as tentativas.")
            raise TimeoutError("O GitHub Models demorou muito para responder.")
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code in RETRYABLE_STATUS_CODES and tentativa < len(RETRY_DELAYS_SECONDS):
                delay = RETRY_DELAYS_SECONDS[tentativa]
                logger.warning(
                    "Retry %s/2 em %s — aguardando %ss",
                    tentativa + 1,
                    status_code,
                    delay,
                )
                await asyncio.sleep(delay)
                continue

            logger.error(
                "Erro HTTP do GitHub Models: status %s — corpo: %s",
                status_code,
                exc.response.text,
            )
            raise


async def chamar_github_models(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    response_format: dict | None = None,
    timeout: float = 30.0,
) -> str:
    """Chama {base_url}/chat/completions no GitHub Models e retorna o texto da resposta.

    Trata httpx.TimeoutException com retry e levanta TimeoutError após timeouts esgotados.
    Levanta GitHubModelsNotConfigured, httpx.HTTPStatusError ou ValueError.
    """
    data = await _chamar_github_models_raw(system_prompt, user_prompt, temperature, max_tokens, response_format, timeout)
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Resposta do GitHub Models sem 'choices[0].message.content': %s", data)
        raise ValueError("Resposta inesperada do GitHub Models.") from exc


async def chamar_github_models_com_uso(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    response_format: dict | None = None,
    timeout: float = 30.0,
) -> tuple[str, int | None]:
    """Mesma chamada de chamar_github_models, mas também retorna o total de tokens usados."""
    data = await _chamar_github_models_raw(system_prompt, user_prompt, temperature, max_tokens, response_format, timeout)
    try:
        conteudo = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Resposta do GitHub Models sem 'choices[0].message.content': %s", data)
        raise ValueError("Resposta inesperada do GitHub Models.") from exc
    tokens_usados = data.get("usage", {}).get("total_tokens")
    return conteudo, tokens_usados

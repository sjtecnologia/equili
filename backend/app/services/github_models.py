"""Cliente central para o GitHub Models (https://models.github.ai/) — API compatível com OpenAI.

Usado pelo gerador de Plano de Ação e pelo Assistente IA (chat).
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

FALLBACK_MODEL = "openai/gpt-4o-mini"


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
) -> dict:
    """Faz a chamada HTTP em si e retorna o corpo JSON bruto da resposta."""
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

    response: httpx.Response | None = None
    max_tentativas = 2  # 1 tentativa original + 1 retry em caso de timeout
    for tentativa in range(max_tentativas):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            break
        except httpx.TimeoutException:
            logger.warning("Timeout ao chamar GitHub Models (tentativa %s/%s).", tentativa + 1, max_tentativas)
            if tentativa + 1 >= max_tentativas:
                raise TimeoutError("O GitHub Models demorou muito para responder.")
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Erro HTTP do GitHub Models: status %s — corpo: %s",
                exc.response.status_code,
                exc.response.text,
            )
            raise

    assert response is not None
    try:
        return response.json()
    except ValueError as exc:
        logger.error("Resposta não-JSON do GitHub Models.")
        raise ValueError("Resposta inválida do GitHub Models.") from exc


async def chamar_github_models(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    response_format: dict | None = None,
) -> str:
    """Chama {base_url}/chat/completions no GitHub Models e retorna o texto da resposta.

    Levanta GitHubModelsNotConfigured, httpx.HTTPStatusError, TimeoutError ou ValueError.
    """
    data = await _chamar_github_models_raw(system_prompt, user_prompt, temperature, max_tokens, response_format)
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
) -> tuple[str, int | None]:
    """Mesma chamada de chamar_github_models, mas também retorna o total de tokens usados."""
    data = await _chamar_github_models_raw(system_prompt, user_prompt, temperature, max_tokens, response_format)
    try:
        conteudo = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Resposta do GitHub Models sem 'choices[0].message.content': %s", data)
        raise ValueError("Resposta inesperada do GitHub Models.") from exc
    tokens_usados = data.get("usage", {}).get("total_tokens")
    return conteudo, tokens_usados

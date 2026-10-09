"""Cliente central para o OpenRouter (https://openrouter.ai) — API compatível com OpenAI.

Usado pelo gerador de Plano de Ação, pelo Assistente IA (chat) e pelo assistente de voz.
Utiliza modelos gratuitos (IDs com sufixo `:free`) com fallback automático para um
segundo modelo quando o principal falha (ex.: gratuito fora de estoque ou instável).

Modelos padrão (configuráveis via env):
  - Primário:  nvidia/nemotron-3-super-120b-a12b:free  (forte, rápido com reasoning off)
  - Fallback:  google/gemma-4-26b-a4b-it:free          (outro vendor, também com JSON mode)

Observações sobre modelos `:free` do OpenRouter:
  - A capacidade oscila (erros 429/502/503/504); o fallback cobre esses casos.
  - `OPENROUTER_DISABLE_REASONING` (padrão True) desliga o "thinking" para evitar que
    modelos de raciocínio consumam o `max_tokens` e truncar o JSON. Se o modelo exigir
    reasoning, o cliente reenvia automaticamente a chamada sem o parâmetro.
"""
import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_CHAT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
FALLBACK_MODEL = "google/gemma-4-26b-a4b-it:free"
RETRYABLE_STATUS_CODES = {429, 503}
# Status que indicam falha do modelo/upstream específico (grátis fora de estoque,
# rate-limit do provedor, modelo removido ou parâmetro não suportado) — acionam o
# modelo de fallback. O OpenRouter encapsula erros de upstream como 500/502/503/504.
FALLBACK_STATUS_CODES = {400, 404, 408, 429, 500, 502, 503, 504}
RETRY_DELAYS_SECONDS = (1, 2)
# Indícios de que o modelo não aceita reasoning desligado (ex.: "Reasoning is mandatory
# for this endpoint and cannot be disabled.").
_MANDATORY_REASONING_HINTS = ("mandatory", "cannot be disabled", "is required", "not supported")


class OpenRouterNotConfigured(Exception):
    """Levantado quando OPENROUTER_API_KEY não está configurado."""


def get_openrouter_config() -> tuple[str, str, str, str]:
    """Lê base_url, api_key, modelo primário e modelo fallback das configurações."""
    base_url = settings.OPENROUTER_BASE_URL.rstrip("/")
    api_key = settings.OPENROUTER_API_KEY
    model = settings.OPENROUTER_CHAT_MODEL or DEFAULT_CHAT_MODEL
    fallback_model = settings.OPENROUTER_FALLBACK_MODEL or FALLBACK_MODEL
    if not api_key:
        logger.warning("OpenRouter não configurado — OPENROUTER_API_KEY ausente.")
    return base_url, api_key, model, fallback_model


def _payload_reasoning_desligado() -> dict | None:
    """Retorna o parâmetro `reasoning` para desligar o thinking, se configurado."""
    if settings.OPENROUTER_DISABLE_REASONING:
        return {"enabled": False}
    return None


def _erro_exige_reasoning(texto: str) -> bool:
    """Detecta resposta de erro indicando que o modelo exige reasoning habilitado."""
    if "reasoning" not in texto.lower():
        return False
    return any(pista in texto.lower() for pista in _MANDATORY_REASONING_HINTS)


async def _chamar_modelo(
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    response_format: dict | None,
    timeout: float,
) -> dict:
    """Faz a chamada HTTP para um modelo específico e retorna o corpo JSON bruto.

    Trata httpx.TimeoutException com retry e levanta TimeoutError após esgotadas
    as tentativas. Levanta httpx.HTTPStatusError em erro HTTP.
    """
    payload: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    reasoning = _payload_reasoning_desligado()
    if reasoning is not None:
        payload["reasoning"] = reasoning
    if response_format:
        payload["response_format"] = response_format

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Title": settings.APP_NAME,
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
                logger.error("Resposta não-JSON do OpenRouter (modelo %s).", model)
                raise ValueError("Resposta inválida do OpenRouter.") from exc
        except httpx.TimeoutException:
            if tentativa < len(RETRY_DELAYS_SECONDS):
                delay = RETRY_DELAYS_SECONDS[tentativa]
                logger.warning(
                    "Timeout ao chamar OpenRouter (modelo %s, tentativa %s/%s) — aguardando %ss",
                    model,
                    tentativa + 1,
                    len(RETRY_DELAYS_SECONDS) + 1,
                    delay,
                )
                await asyncio.sleep(delay)
                continue

            logger.error("Timeout ao chamar OpenRouter (modelo %s) após todas as tentativas.", model)
            raise TimeoutError("O OpenRouter demorou muito para responder.")
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            corpo = exc.response.text or ""

            # Modelo exige reasoning habilitado → reenvia sem o parâmetro.
            if "reasoning" in payload and status_code == 400 and _erro_exige_reasoning(corpo):
                logger.info(
                    "Modelo %s exige reasoning habilitado — reenviando sem o parâmetro.", model
                )
                payload.pop("reasoning", None)
                continue

            if status_code in RETRYABLE_STATUS_CODES and tentativa < len(RETRY_DELAYS_SECONDS):
                delay = RETRY_DELAYS_SECONDS[tentativa]
                logger.warning(
                    "Retry %s/%s em %s (modelo %s) — aguardando %ss",
                    tentativa + 1,
                    len(RETRY_DELAYS_SECONDS),
                    status_code,
                    model,
                    delay,
                )
                await asyncio.sleep(delay)
                continue

            logger.error(
                "Erro HTTP do OpenRouter (modelo %s): status %s — corpo: %s",
                model,
                status_code,
                corpo[:500],
            )
            raise


async def _chamar_openrouter_raw(
    system_prompt: str,
    user_prompt: str,
    temperature: float,
    max_tokens: int,
    response_format: dict | None,
    timeout: float = 30.0,
) -> dict:
    """Chama o modelo primário e, em falha específica do modelo, o fallback.

    Timeout e resposta inválida NÃO acionam o fallback (para não dobrar a espera);
    são propagados diretamente ao chamador.
    """
    base_url, api_key, model, fallback_model = get_openrouter_config()
    if not api_key:
        raise OpenRouterNotConfigured(
            "OpenRouter não configurado — defina OPENROUTER_API_KEY."
        )

    kwargs = dict(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format=response_format,
        timeout=timeout,
    )
    try:
        return await _chamar_modelo(base_url, api_key, model, **kwargs)
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        if status_code in FALLBACK_STATUS_CODES and fallback_model and fallback_model != model:
            logger.warning(
                "OpenRouter: modelo %s falhou com status %s — tentando fallback %s.",
                model,
                status_code,
                fallback_model,
            )
            return await _chamar_modelo(base_url, api_key, fallback_model, **kwargs)
        raise


async def chamar_openrouter(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    response_format: dict | None = None,
    timeout: float = 30.0,
) -> str:
    """Chama {base_url}/chat/completions no OpenRouter e retorna o texto da resposta.

    Trata httpx.TimeoutException com retry e levanta TimeoutError após timeouts esgotados.
    Levanta OpenRouterNotConfigured, httpx.HTTPStatusError ou ValueError.
    """
    data = await _chamar_openrouter_raw(
        system_prompt, user_prompt, temperature, max_tokens, response_format, timeout
    )
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Resposta do OpenRouter sem 'choices[0].message.content': %s", data)
        raise ValueError("Resposta inesperada do OpenRouter.") from exc


async def chamar_openrouter_com_uso(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    response_format: dict | None = None,
    timeout: float = 30.0,
) -> tuple[str, int | None]:
    """Mesma chamada de chamar_openrouter, mas também retorna o total de tokens usados."""
    data = await _chamar_openrouter_raw(
        system_prompt, user_prompt, temperature, max_tokens, response_format, timeout
    )
    try:
        conteudo = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Resposta do OpenRouter sem 'choices[0].message.content': %s", data)
        raise ValueError("Resposta inesperada do OpenRouter.") from exc
    tokens_usados = data.get("usage", {}).get("total_tokens")
    return conteudo, tokens_usados

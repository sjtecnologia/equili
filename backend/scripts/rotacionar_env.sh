#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE="${1:-${ENV_FILE:-.env}}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo de ambiente não encontrado: $ENV_FILE" >&2
  exit 1
fi

BACKUP_PATH="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
cp -a "$ENV_FILE" "$BACKUP_PATH"

echo "Backup do ambiente criado em: $BACKUP_PATH"

required_vars=(
  SECRET_KEY
  GITHUB_TOKEN
  RESEND_API_KEY
  STRIPE_SECRET_KEY
  VAPID_PUBLIC_KEY
  VAPID_PRIVATE_KEY_B64
  DATABASE_URL
)

missing=0
for var in "${required_vars[@]}"; do
  if ! grep -Eq "^${var}=" "$ENV_FILE"; then
    echo "Variável ausente: ${var}" >&2
    missing=1
    continue
  fi

  value="$(grep -E "^${var}=" "$ENV_FILE" | head -n 1 | cut -d= -f2-)"
  if [[ -z "${value//[[:space:]]/}" ]]; then
    echo "Variável vazia: ${var}" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Validação falhou: preencha todas as variáveis antes de reiniciar o serviço." >&2
  exit 1
fi

echo "Validação concluída: todas as variáveis obrigatórias foram preenchidas."
echo "" 
echo "Próximo passo: reinicie o serviço com a linha abaixo."
echo "sudo systemctl restart <serviço>"
echo "" 
echo "Não foram impressos os valores dos segredos."

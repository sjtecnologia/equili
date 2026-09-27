#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${1:-https://api.exemplo.com}"

printf "\n[1/3] Verificando saúde do backend...\n"
if curl -fsS "${BASE_URL}/health" >/tmp/equili-health.out 2>/tmp/equili-health.err; then
  echo "OK: health check respondeu com sucesso."
else
  echo "FALHA: health check não respondeu corretamente." >&2
  echo "Verifique o serviço, porta e TLS do ambiente." >&2
  exit 1
fi

printf "\n[2/3] Validando login com credenciais de teste...\n"
read -r -p "Email para login de verificação: " LOGIN_EMAIL
read -r -s -p "Senha para login de verificação: " LOGIN_PASSWORD
printf "\n"

LOGIN_BODY=$(printf '{"email":"%s","senha":"%s"}' "$LOGIN_EMAIL" "$LOGIN_PASSWORD")

HTTP_CODE=$(curl -sS -o /tmp/equili-login.out -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/api/v1/auth/login" \
  --data "$LOGIN_BODY" || true)

if [[ "$HTTP_CODE" =~ ^2 ]]; then
  echo "OK: login respondeu com sucesso."
else
  echo "FALHA: login não foi aceito. HTTP $HTTP_CODE" >&2
  exit 1
fi

printf "\n[3/3] Verificando carregamento do dashboard...\n"
read -r -p "Informe a rota do dashboard para validação (ex.: /api/v1/dashboard): " DASHBOARD_PATH
DASHBOARD_URL="${BASE_URL}${DASHBOARD_PATH}"

if curl -fsS "$DASHBOARD_URL" >/tmp/equili-dashboard.out 2>/tmp/equili-dashboard.err; then
  echo "OK: dashboard respondeu com sucesso."
else
  echo "FALHA: dashboard não respondeu corretamente." >&2
  exit 1
fi

echo "\nChecklist concluído com sucesso."
echo "Observação: este script não imprime senhas, tokens ou respostas completas do servidor."

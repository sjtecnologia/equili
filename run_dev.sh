#!/usr/bin/env bash
# run_dev.sh — inicia backend e frontend em paralelo
# Uso: ./run_dev.sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Backend ──────────────────────────────────────────────────
start_backend() {
  echo "▶  Iniciando backend (FastAPI)..."
  cd "$ROOT_DIR/backend"

  if [[ ! -d ".venv" ]]; then
    echo "   Criando virtualenv..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
  else
    source .venv/bin/activate
  fi

  if [[ ! -f ".env" ]]; then
    cp "$ROOT_DIR/.env.example" .env
    echo "   ⚠  Arquivo backend/.env criado a partir de .env.example. Configure as variáveis antes de continuar."
  fi

  uvicorn app.main:app --reload --port 8000
}

# ── Frontend ─────────────────────────────────────────────────
start_frontend() {
  echo "▶  Iniciando frontend (Vite)..."
  cd "$ROOT_DIR/frontend"

  if [[ ! -d "node_modules" ]]; then
    echo "   Instalando dependências npm..."
    npm install
  fi

  if [[ ! -f ".env" ]]; then
    cp "$ROOT_DIR/.env.example" .env
  fi

  npm run dev
}

# ── Main ─────────────────────────────────────────────────────
trap 'kill 0' EXIT

start_backend &
BACKEND_PID=$!

start_frontend &
FRONTEND_PID=$!

echo ""
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo "  Pressione Ctrl+C para encerrar."
echo ""

wait $BACKEND_PID $FRONTEND_PID

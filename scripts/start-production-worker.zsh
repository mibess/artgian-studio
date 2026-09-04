#!/bin/zsh
set -euo pipefail

cd "${0:A:h}/.."

if [[ -f .env.local ]]; then
  set -a
  source .env.local
  set +a
fi

if ! command -v turso >/dev/null 2>&1; then
  echo "Turso CLI não encontrado; instale e autentique antes de iniciar o worker."
  exit 1
fi

export COMMERCIAL_DATABASE_MODE=turso
export COMMERCIAL_DEMO_MODE=false
export APP_URL="${PRODUCTION_APP_URL:-https://www.artgian.com.br}"
export TURSO_DATABASE_URL="$(turso db show artgian-prod --url)"
export TURSO_AUTH_TOKEN="$(turso db tokens create artgian-prod --expiration 30d)"
export INSTAGRAM_AUTO_REPLY_ENABLED=true
export FOLLOWUP_REVIEW_ENABLED=true
export OUTBOUND_AUTOMATION_ENABLED="${WORKER_ENABLE_OUTBOUND:-false}"
export BROWSER_SEND_ENABLED="${WORKER_ENABLE_OUTBOUND:-false}"
export MAX_DMS_PER_DAY="${WORKER_MAX_DMS_PER_DAY:-3}"
export MIN_SECONDS_BETWEEN_DMS="${WORKER_MIN_SECONDS_BETWEEN_DMS:-300}"
export MAX_SECONDS_BETWEEN_DMS="${WORKER_MAX_SECONDS_BETWEEN_DMS:-900}"
export OPERATING_HOURS="${OPERATING_HOURS:-09:00-18:00}"
export OPERATING_TIMEZONE="${OPERATING_TIMEZONE:-America/Sao_Paulo}"

exec pnpm tsx worker/index.ts

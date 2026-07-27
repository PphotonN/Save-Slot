#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

printf '\n========================================\n'
printf '  SAVE SLOT v1 - LOCAL LAUNCHER\n'
printf '========================================\n\n'

if ! command -v node >/dev/null 2>&1; then
  printf '[ERROR] Node.js 20.19 or newer is required.\n' >&2
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  PNPM=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  if ! corepack pnpm --version >/dev/null 2>&1; then
    printf '[SETUP] Preparing pnpm 10.14.0 through Corepack...\n'
    corepack prepare pnpm@10.14.0 --activate
  fi
  PNPM=(corepack pnpm)
else
  printf '[ERROR] pnpm or Corepack is required.\n' >&2
  exit 1
fi

if [[ ! -f apps/web/.env ]]; then
  printf '[SETUP] Creating apps/web/.env...\n'
  cp apps/web/.env.example apps/web/.env
fi

if [[ ! -f apps/api/.dev.vars ]]; then
  printf '[SETUP] Creating apps/api/.dev.vars...\n'
  cp apps/api/.dev.vars.example apps/api/.dev.vars
fi

if [[ ! -d node_modules/.pnpm ]]; then
  printf '[SETUP] Installing dependencies. This is required only on the first launch...\n'
  "${PNPM[@]}" install
fi

cleanup() {
  trap - EXIT INT TERM
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

printf '[START] Launching Save Slot API on http://localhost:8787 ...\n'
"${PNPM[@]}" dev:api &
API_PID=$!

sleep 2

printf '[START] Launching Save Slot web app on http://localhost:5173 ...\n'
"${PNPM[@]}" dev &
WEB_PID=$!

sleep 3
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:5173 >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open http://localhost:5173 >/dev/null 2>&1 || true
fi

printf '\nSave Slot is running. Press Ctrl+C to stop both processes.\n\n'
wait "$WEB_PID"

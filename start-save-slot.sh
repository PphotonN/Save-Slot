#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

NODE_REQUIRED_MAJOR=24
PNPM_VERSION_REQUIRED=10.14.0
PROBE_SCRIPT="$ROOT_DIR/scripts/service-probe.mjs"
LIBRARY_PID=''
API_PID=''
WEB_PID=''
LAST_SERVICE_PID=''

printf '\n========================================\n'
printf '  SAVE SLOT v1 - LOCAL LAUNCHER\n'
printf '========================================\n\n'

if ! command -v node >/dev/null 2>&1; then
  printf '[ERROR] Node.js 24 or newer is required.\n' >&2
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < NODE_REQUIRED_MAJOR )); then
  printf '[ERROR] Node.js 24 or newer is required. Current version: %s\n' "$(node --version)" >&2
  exit 1
fi

if [[ ! -f "$PROBE_SCRIPT" || ! -f pnpm-lock.yaml ]]; then
  printf '[ERROR] Startup files or pnpm-lock.yaml are missing. Update app-v1 and try again.\n' >&2
  exit 1
fi

if command -v pnpm >/dev/null 2>&1 && [[ "$(pnpm --version 2>/dev/null || true)" == "$PNPM_VERSION_REQUIRED" ]]; then
  PNPM=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  printf '[SETUP] Preparing pnpm %s through Corepack...\n' "$PNPM_VERSION_REQUIRED"
  corepack prepare "pnpm@$PNPM_VERSION_REQUIRED" --activate
  PNPM=(corepack pnpm)
  if [[ "$("${PNPM[@]}" --version)" != "$PNPM_VERSION_REQUIRED" ]]; then
    printf '[ERROR] Corepack did not provide pnpm %s.\n' "$PNPM_VERSION_REQUIRED" >&2
    exit 1
  fi
else
  printf '[ERROR] pnpm %s or Corepack is required.\n' "$PNPM_VERSION_REQUIRED" >&2
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

printf '[SETUP] Installing or validating dependencies from pnpm-lock.yaml...\n'
"${PNPM[@]}" install --prefer-offline --frozen-lockfile

terminate_tree() {
  local pid="$1"
  if ! kill -0 "$pid" 2>/dev/null; then
    return
  fi
  if command -v pkill >/dev/null 2>&1; then
    pkill -TERM -P "$pid" 2>/dev/null || true
  fi
  kill "$pid" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  [[ -n "$WEB_PID" ]] && terminate_tree "$WEB_PID"
  [[ -n "$API_PID" ]] && terminate_tree "$API_PID"
  [[ -n "$LIBRARY_PID" ]] && terminate_tree "$LIBRARY_PID"
}
trap cleanup EXIT INT TERM

probe_service() {
  local mode="$1"
  local url="$2"
  local service="$3"
  local timeout_ms="$4"
  local project_root="${5:-}"
  local arguments=("$PROBE_SCRIPT" "$mode" --url "$url" --service "$service" --timeout-ms "$timeout_ms" --quiet)
  if [[ -n "$project_root" ]]; then
    arguments+=(--project-root "$project_root")
  fi
  node "${arguments[@]}"
}

port_is_free() {
  node "$PROBE_SCRIPT" port-free --host "$1" --port "$2" --quiet
}

start_service() {
  local display_name="$1"
  local service_id="$2"
  local command_name="$3"
  local host="$4"
  local port="$5"
  local health_url="$6"
  local timeout_ms="$7"
  local project_root="${8:-}"
  local optional="${9:-false}"
  local probe_code=0
  LAST_SERVICE_PID=''

  if probe_service probe "$health_url" "$service_id" 1500 "$project_root"; then
    printf '[READY] %s already running.\n' "$display_name"
    return 0
  else
    probe_code=$?
  fi

  if (( probe_code == 2 )); then
    printf '[ERROR] Port %s responds, but it is not the expected %s.\n' "$port" "$display_name" >&2
    return 1
  fi

  if ! port_is_free "$host" "$port"; then
    printf '[ERROR] Port %s is occupied. Close the program using it and retry.\n' "$port" >&2
    return 1
  fi

  printf '[START] %s on http://%s:%s ...\n' "$display_name" "$host" "$port"
  "${PNPM[@]}" "$command_name" &
  LAST_SERVICE_PID=$!

  if probe_service wait "$health_url" "$service_id" "$timeout_ms" "$project_root"; then
    printf '[READY] %s\n' "$display_name"
    return 0
  fi

  if [[ "$optional" == 'true' ]]; then
    printf '[WARN] %s did not become ready. The web app will use its offline fallback.\n' "$display_name" >&2
    return 0
  fi

  printf '[ERROR] %s did not become ready. Review the terminal output above.\n' "$display_name" >&2
  return 1
}

start_service 'Save Slot Library' 'save-slot-library-cache' 'dev:library' '127.0.0.1' '8791' 'http://127.0.0.1:8791/health' '20000' "$ROOT_DIR"
LIBRARY_PID="$LAST_SERVICE_PID"

start_service 'Save Slot API' 'save-slot-api' 'dev:api' '127.0.0.1' '8787' 'http://127.0.0.1:8787/health' '45000' '' 'true'
API_PID="$LAST_SERVICE_PID"

start_service 'Save Slot Web' 'save-slot-web' 'dev' '127.0.0.1' '5173' 'http://127.0.0.1:5173/health.json' '60000'
WEB_PID="$LAST_SERVICE_PID"

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://127.0.0.1:5173 >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open http://127.0.0.1:5173 >/dev/null 2>&1 || true
fi

printf '\nSave Slot is running. The collection is mirrored to .save-slot-data/library.json.\n'
printf 'Press Ctrl+C to stop services started by this launcher.\n\n'

if [[ -n "$WEB_PID" ]]; then
  wait "$WEB_PID"
elif [[ -n "$LIBRARY_PID" || -n "$API_PID" ]]; then
  while true; do
    alive=false
    for pid in "$LIBRARY_PID" "$API_PID"; do
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        alive=true
      fi
    done
    [[ "$alive" == 'true' ]] || break
    sleep 1
  done
else
  trap - EXIT INT TERM
fi

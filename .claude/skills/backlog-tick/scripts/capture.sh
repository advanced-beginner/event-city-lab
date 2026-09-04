#!/bin/zsh
set -euo pipefail

ID="${1:?usage: capture.sh <ITEM-ID> [chapters]}"
CHAPTERS="${2:-1,2,6}"
SCRIPT_DIR="${0:A:h}"
ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PORT="${ECL_PORT:-4199}"
OUT="$ROOT/.omx/artifacts/backlog/$ID"

mkdir -p "$OUT"
cd "$ROOT"

command npm run build

"$ROOT/node_modules/.bin/vite" preview --host 127.0.0.1 --port "$PORT" --strictPort > "$OUT/preview.log" 2>&1 &
PREVIEW_PID=$!

cleanup() {
  kill "$PREVIEW_PID" 2>/dev/null || true
  wait "$PREVIEW_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

code=$(curl -sS -o /dev/null -w '%{http_code}' --retry 30 --retry-delay 1 --retry-connrefused --retry-all-errors "http://127.0.0.1:$PORT/event-city-lab/" || true)
if [ "$code" != "200" ]; then
  cat "$OUT/preview.log"
  echo "preview did not answer 200 on port $PORT (got '$code')"
  exit 1
fi

TICK_ROOT="$ROOT" TICK_OUT="$OUT" TICK_PORT="$PORT" TICK_CHAPTERS="$CHAPTERS" \
  command node "$SCRIPT_DIR/capture.mjs" | tee "$OUT/result.json"

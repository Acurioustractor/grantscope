#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/benknight/Code/grantscope"
cd "$ROOT"

mkdir -p tmp

STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$ROOT/tmp/ndis-provider-register-resume-$STAMP.log"
PID_FILE="$ROOT/tmp/ndis-provider-register-resume.pid"

nohup node --env-file=.env scripts/repair-ndis-provider-register.mjs --concurrency=4 >"$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"

echo "[run-ndis-provider-register-resume] PID $PID"
echo "[run-ndis-provider-register-resume] Log $LOG_FILE"

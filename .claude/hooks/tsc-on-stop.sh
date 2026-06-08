#!/bin/bash
# Stop hook: when a turn ends, if apps/web TypeScript changed and no longer
# type-checks, block the stop and feed the errors back to Claude so they get
# fixed before "done" — catching schema-drift early, ahead of the commit gate
# and CI. apps/web is kept at zero tsc errors, so any error here is new.
#
# Loop-safe: backs off if we're already inside a stop-hook continuation.
# Fast: no-op unless an apps/web .ts/.tsx actually changed (incremental tsc).

REPO="/Users/benknight/Code/grantscope"

# Read the Stop event JSON from stdin. If stop_hook_active is true we're already
# in a hook-triggered continuation — let the turn end to avoid an infinite loop.
INPUT=$(cat)
STOP_ACTIVE=$(printf '%s' "$INPUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).stop_hook_active?'1':'0')}catch{process.stdout.write('0')}})" 2>/dev/null)
[ "$STOP_ACTIVE" = "1" ] && exit 0

cd "$REPO" || exit 0

# Fast guard: only typecheck when an apps/web .ts/.tsx is dirty this session.
if ! git status --porcelain -- apps/web 2>/dev/null | grep -qE '\.tsx?$'; then
  exit 0
fi

# Incremental typecheck (warm cache ~2-5s).
OUT=$(cd apps/web && npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  {
    echo "🔴 apps/web no longer type-checks — fix before finishing the turn."
    printf '%s\n' "$OUT" | grep -E 'error TS' | head -20
    echo "(apps/web is kept at zero tsc errors; the above were just introduced.)"
  } >&2
  exit 2
fi
exit 0

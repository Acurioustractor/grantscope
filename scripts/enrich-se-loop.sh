#!/bin/bash
# Loop enrichment until all social enterprises are enriched
# Usage: bash scripts/enrich-se-loop.sh

BATCH_SIZE=200
CONCURRENCY=5
LOG_FILE="/tmp/enrich-se-loop.log"

echo "[$(date)] Starting enrichment loop (batch=$BATCH_SIZE, concurrency=$CONCURRENCY)" | tee -a "$LOG_FILE"

while true; do
  # Check remaining count
  REMAINING=$(node -e "
    const { createClient } = require('@supabase/supabase-js');
    const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    s.from('social_enterprises').select('*', {count:'exact', head:true}).is('enriched_at', null)
      .then(r => console.log(r.count || 0));
  " 2>/dev/null)

  echo "[$(date)] Remaining: $REMAINING" | tee -a "$LOG_FILE"

  if [ "$REMAINING" = "0" ] || [ -z "$REMAINING" ]; then
    echo "[$(date)] All records enriched! Done." | tee -a "$LOG_FILE"
    break
  fi

  # Run a batch
  echo "[$(date)] Running batch of $BATCH_SIZE..." | tee -a "$LOG_FILE"
  node scripts/enrich-social-enterprises.mjs --limit=$BATCH_SIZE --concurrency=$CONCURRENCY 2>&1 | tee -a "$LOG_FILE"

  # Brief pause between batches
  sleep 5
done

# Final count
ENRICHED=$(node -e "
  const { createClient } = require('@supabase/supabase-js');
  const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  s.from('social_enterprises').select('*', {count:'exact', head:true}).not('enriched_at', 'is', null)
    .then(r => console.log(r.count || 0));
" 2>/dev/null)

echo "[$(date)] Final enriched count: $ENRICHED" | tee -a "$LOG_FILE"

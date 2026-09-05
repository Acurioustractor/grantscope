-- Phase 7 (early start) — closed-loop learning from decisions
-- Funder blocklist mirrors funder_allowlist but is auto-populated from passed-decision patterns

CREATE TABLE IF NOT EXISTS funder_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_name text UNIQUE NOT NULL,
  funder_aliases text[],
  reason text,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  blocked_by text,
  -- Decision tally at time of block (for audit)
  pass_count int DEFAULT 0,
  watch_count int DEFAULT 0,
  pursue_count int DEFAULT 0,
  -- Manual override: a human can mark a blocklist entry "review" so it stops applying
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS funder_blocklist_active_idx ON funder_blocklist (active) WHERE active = true;

-- Auto-block any funder where the user passed >= 2 times and never watched/pursued
INSERT INTO funder_blocklist (funder_name, reason, blocked_by, pass_count, watch_count, pursue_count)
SELECT
  a.funder_name,
  'auto-block: ' || COUNT(*) FILTER (WHERE d.decision='passed') || ' passes, 0 watches/pursues',
  'auto:decision-learn-2026-05-15',
  COUNT(*) FILTER (WHERE d.decision='passed'),
  COUNT(*) FILTER (WHERE d.decision='watching'),
  COUNT(*) FILTER (WHERE d.decision='pursuing')
FROM act_grant_recommendation_decisions d
JOIN alma_funding_opportunities a ON a.id::text = d.opportunity_id::text
GROUP BY a.funder_name
HAVING
  COUNT(*) FILTER (WHERE d.decision='passed') >= 2
  AND COUNT(*) FILTER (WHERE d.decision='watching') = 0
  AND COUNT(*) FILTER (WHERE d.decision='pursuing') = 0
  AND a.funder_name IS NOT NULL
ON CONFLICT (funder_name) DO UPDATE SET
  pass_count = EXCLUDED.pass_count,
  watch_count = EXCLUDED.watch_count,
  pursue_count = EXCLUDED.pursue_count,
  reason = EXCLUDED.reason,
  updated_at = now(),
  active = true;

-- Print the blocked funders
SELECT funder_name, reason FROM funder_blocklist WHERE active = true ORDER BY pass_count DESC;

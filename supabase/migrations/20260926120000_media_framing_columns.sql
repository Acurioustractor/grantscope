-- JusticeHub media framing (2026-09-26).
--
-- Adds what the new framing job writes to alma_media_articles, and exposes it on
-- alma_media_articles_publishable. Owner: JusticeHub. Consumer: JusticeHub
-- /intelligence/media (later) and /admin/jobs.
--
-- Why new columns rather than `sentiment`: `sentiment` is positive/negative/
-- neutral/mixed (alma_media_articles_sentiment_check). Framing is a different
-- measure (fear_narrative / solutions_focused / mixed / neutral), measured against
-- Ben's 20-answer check on 2026-09-26: Jev 31/31 on "about youth justice" for full
-- articles, 14/15 on framing when at least 0.7 sure.
--
--   publisher_url            the article's own address (the feed stores a news.google.com redirect)
--   found_by_query           the news search that found it, so the mix of searches is visible
--   framing_basis            what was judged: 'article' text, the 'headline' only (a publisher
--                            that blocks automated readers), or 'unreadable'
--   is_youth_justice         model answer, with youth_justice_confidence
--   framing                  model answer, set only when framing_confidence >= the gate's bar;
--                            framing_confidence is kept either way
--   framing_model            the model version that answered (receipts in model_writes)
--   framing_at               when the job judged the row
--
-- Every value the model writes also has a model_writes receipt (JusticeHub fillFromModel).
-- Undo: drop the nine columns and restore the view without them (definition below, minus
-- the added columns).

ALTER TABLE public.alma_media_articles
  ADD COLUMN IF NOT EXISTS publisher_url text,
  ADD COLUMN IF NOT EXISTS found_by_query text,
  ADD COLUMN IF NOT EXISTS framing_basis text,
  ADD COLUMN IF NOT EXISTS is_youth_justice boolean,
  ADD COLUMN IF NOT EXISTS youth_justice_confidence numeric,
  ADD COLUMN IF NOT EXISTS framing text,
  ADD COLUMN IF NOT EXISTS framing_confidence numeric,
  ADD COLUMN IF NOT EXISTS framing_model text,
  ADD COLUMN IF NOT EXISTS framing_at timestamptz;

ALTER TABLE public.alma_media_articles
  ADD CONSTRAINT alma_media_articles_framing_check
    CHECK (framing IS NULL OR framing IN ('fear_narrative', 'solutions_focused', 'mixed', 'neutral')),
  ADD CONSTRAINT alma_media_articles_framing_basis_check
    CHECK (framing_basis IS NULL OR framing_basis IN ('article', 'headline', 'unreadable')),
  ADD CONSTRAINT alma_media_articles_framing_confidence_check
    CHECK (framing_confidence IS NULL OR (framing_confidence >= 0 AND framing_confidence <= 1)),
  ADD CONSTRAINT alma_media_articles_youth_justice_confidence_check
    CHECK (youth_justice_confidence IS NULL OR (youth_justice_confidence >= 0 AND youth_justice_confidence <= 1));

-- Same view, the new columns appended (CREATE OR REPLACE may only add at the end).
-- security_invoker stays on; existing grants are kept by CREATE OR REPLACE.
CREATE OR REPLACE VIEW public.alma_media_articles_publishable
WITH (security_invoker = true) AS
SELECT
  id,
  job_id,
  headline,
  url,
  published_date,
  source_name,
  sentiment,
  sentiment_score,
  confidence,
  topics,
  government_mentions,
  community_mentions,
  intervention_mentions,
  summary,
  key_quotes,
  full_text,
  created_at,
  updated_at,
  organizations_mentioned,
  programs_mentioned,
  key_claims,
  quarantined_at,
  quarantine_reason,
  publisher_url,
  found_by_query,
  framing_basis,
  is_youth_justice,
  youth_justice_confidence,
  framing,
  framing_confidence,
  framing_model,
  framing_at
FROM public.alma_media_articles
WHERE quarantined_at IS NULL;

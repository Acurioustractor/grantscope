-- Price three of the five models JusticeHub called in September 2026, so v_llm_spend_monthly can count them. Each
-- price below was checked on 2026-09-26 against its source; the one that could not be checked stays NULL (unknown),
-- because a guessed price would read as a measured cost.
--
--   jev / jev-1.13.0: $0.042 per 1M input tokens, output free. Source: madewithjev.com pricing guide, "$0.042 per
--     million input tokens, output free", read 2026-09-26. JusticeHub's first Jev call was 2026-09-26.
--
--   groq / openai/gpt-oss-120b: $0, because the key is on Groq's Free Plan. Evidence: a call on 2026-09-26 returned
--     x-ratelimit-limit-requests 1000 and x-ratelimit-limit-tokens 8000, which are the Free Plan limits for this
--     model on console.groq.com/docs/rate-limits (1K requests a day, 8K tokens a minute). JusticeHub's first call to
--     it was 2026-09-24. If the key moves to the Developer plan, close this row with effective_until and add the
--     paid price.
--
--   gemini / gemini-2.5-flash: $0, because the key's project is on the free tier. Evidence: Ben read it in AI Studio
--     on 2026-09-26. Google's price on the free tier is "Free of charge"; the paid tier is $0.30 in / $2.50 out per 1M
--     (ai.google.dev/gemini-api/docs/pricing). The existing row (effective_from 2026-08-30) held NULL as a placeholder
--     for "unknown"; it is updated in place rather than a second row added, because two overlapping rows would join
--     every call twice in v_llm_spend_monthly. If billing is enabled on that project, close this row and add the
--     paid price. The same page says free-tier content is "Used to improve our products: Yes".
--
-- Left NULL on purpose:
--   llmapi / gpt-4o: price not checked.
--
-- Undo: DELETE FROM api_pricing WHERE (provider, model, endpoint, effective_from) IN
--   (('jev','jev-1.13.0','chat','2026-09-26'), ('groq','openai/gpt-oss-120b','chat','2026-09-24'));
--   UPDATE api_pricing SET input_price_per_1m = NULL, output_price_per_1m = NULL
--    WHERE provider = 'gemini' AND model = 'gemini-2.5-flash' AND endpoint = 'chat' AND effective_from = '2026-08-30';
-- Apply: scripts/db-apply.sh supabase/migrations/20260926220000_price_jev_and_free_tier_models.sql (Tier 3, Ben's verb)

BEGIN;

INSERT INTO api_pricing (provider, model, endpoint, input_price_per_1m, output_price_per_1m, effective_from) VALUES
  ('jev',  'jev-1.13.0',          'chat', 0.042, 0, '2026-09-26'),
  ('groq', 'openai/gpt-oss-120b', 'chat', 0,     0, '2026-09-24');

-- Only the placeholder: a row someone has since priced is left alone.
UPDATE api_pricing SET input_price_per_1m = 0, output_price_per_1m = 0
 WHERE provider = 'gemini' AND model = 'gemini-2.5-flash' AND endpoint = 'chat' AND effective_from = '2026-08-30'
   AND input_price_per_1m IS NULL AND output_price_per_1m IS NULL;

DO $$
DECLARE n int; g int;
BEGIN
  SELECT count(*) INTO n FROM api_pricing
   WHERE (provider, model, endpoint, effective_from) IN
         (('jev','jev-1.13.0','chat','2026-09-26'::date), ('groq','openai/gpt-oss-120b','chat','2026-09-24'::date));
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 new price rows, found %', n; END IF;
  -- Exactly one Gemini 2.5 Flash chat row may cover September, or the view double-counts its calls.
  SELECT count(*) INTO g FROM api_pricing
   WHERE provider = 'gemini' AND model = 'gemini-2.5-flash' AND endpoint = 'chat'
     AND effective_from <= '2026-09-01' AND (effective_until IS NULL OR effective_until > '2026-09-01')
     AND input_price_per_1m = 0 AND output_price_per_1m = 0;
  IF g <> 1 THEN RAISE EXCEPTION 'expected 1 free Gemini 2.5 Flash row, found %', g; END IF;
END $$;

COMMIT;

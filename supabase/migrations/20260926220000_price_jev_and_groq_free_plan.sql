-- Price two of the five models JusticeHub called in September 2026, so v_llm_spend_monthly can count them. Each price
-- below was checked on 2026-09-26 against its source; the two that could not be checked stay NULL (unknown), because
-- a guessed price would read as a measured cost.
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
-- Left NULL on purpose:
--   gemini / gemini-2.5-flash: Google charges $0 on the free tier and $0.30 in / $2.50 out per 1M on the paid tier
--     (ai.google.dev/gemini-api/docs/pricing). Which tier the key is on shows only in AI Studio. 15 requests at once
--     all succeeded on 2026-09-26, which suggests a paid tier, but Google no longer publishes the free-tier limit,
--     so that is not proof.
--   llmapi / gpt-4o: price not checked.
--
-- Undo: DELETE FROM api_pricing WHERE (provider, model, endpoint, effective_from) IN
--   (('jev','jev-1.13.0','chat','2026-09-26'), ('groq','openai/gpt-oss-120b','chat','2026-09-24'));
-- Apply: scripts/db-apply.sh supabase/migrations/20260926220000_price_jev_and_groq_free_plan.sql (Tier 3, Ben's verb)

BEGIN;

INSERT INTO api_pricing (provider, model, endpoint, input_price_per_1m, output_price_per_1m, effective_from) VALUES
  ('jev',  'jev-1.13.0',          'chat', 0.042, 0, '2026-09-26'),
  ('groq', 'openai/gpt-oss-120b', 'chat', 0,     0, '2026-09-24');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM api_pricing
   WHERE (provider, model, endpoint, effective_from) IN
         (('jev','jev-1.13.0','chat','2026-09-26'::date), ('groq','openai/gpt-oss-120b','chat','2026-09-24'::date));
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 new price rows, found %', n; END IF;
END $$;

COMMIT;

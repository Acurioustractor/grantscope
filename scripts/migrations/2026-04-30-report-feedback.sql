-- Feedback capture for /feedback (replaces /pricing as the conversion endpoint).
-- Goal: learn what readers find valuable and what they'd want more of, before
-- committing to a pricing structure. Every section is a structured tick-box
-- pattern so we can quantify demand signals across procurement, grants,
-- charities, foundations, lobbyists, donations, board networks, geographic
-- overlays, etc.

CREATE TABLE IF NOT EXISTS public.report_feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamp with time zone default now(),

  -- Source attribution — which page they came from
  source_path text,
  source_referrer text,
  report_subject text,                     -- e.g. 'fecca-eccv'

  -- Value indicators (multi-select tick boxes)
  value_signals text[],                    -- ['would_pay','would_recommend','would_change_decision','want_for_my_org','want_for_my_sector','interesting_not_actionable','not_sure_what_for']
  value_score integer,                     -- 1..5 overall scale

  -- Demand: what they want more of (multi-select)
  topics_wanted text[],                    -- ['more_charities','sector_mappings','first_peoples','foundations','federal_procurement','state_grants','local_council','lobbyists','donations','director_interlocks','funder_dependency','peer_comparisons','geographic_lga','cald_demographics','monitoring','director_tenure']
  topics_wanted_other text,

  -- Use case
  use_cases text[],                        -- ['board_strategy','foundation_diligence','journalist','researcher','peak_body','govt_oversight','advocacy','investigation','curiosity']
  use_cases_other text,

  -- Free-text insight
  questions_to_answer text,                -- "what questions would you want answered next?"
  general_feedback text,                   -- open box

  -- Implicit pricing signal (without showing prices)
  willingness_to_pay text,                 -- 'free_only' | 'low_<500' | 'mid_500_2500' | 'high_2500_10000' | 'enterprise_10k_plus' | 'depends'

  -- Optional contact (can submit anonymously)
  contact_name text,
  contact_email text,
  contact_org text,
  contact_role text,
  follow_up_ok boolean default false,

  -- Metadata
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_report_feedback_submitted_at ON public.report_feedback(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_feedback_subject ON public.report_feedback(report_subject) WHERE report_subject IS NOT NULL;

COMMENT ON TABLE public.report_feedback IS
  'Reader feedback on civicgraph reports. Replaces /pricing as the conversion endpoint pre-pricing. Structured signals + free text.';

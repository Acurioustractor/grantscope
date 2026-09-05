CREATE TABLE IF NOT EXISTS public.act_research_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'design'
    CHECK (status IN ('design', 'benchmarking', 'pilot', 'paused', 'complete')),
  current_phase integer NOT NULL DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 5),
  budget_cap_aud numeric NOT NULL DEFAULT 0 CHECK (budget_cap_aud >= 0),
  spend_to_date_aud numeric NOT NULL DEFAULT 0 CHECK (spend_to_date_aud >= 0),
  community_benefit_commitment text NOT NULL,
  governance_principles text[] NOT NULL DEFAULT '{}',
  success_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  stop_conditions text[] NOT NULL DEFAULT '{}',
  next_decision text NOT NULL,
  next_decision_at timestamptz,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.act_research_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.act_research_initiatives(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL,
  hypothesis text NOT NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'running', 'evaluated', 'stopped')),
  budget_cap_aud numeric NOT NULL DEFAULT 0 CHECK (budget_cap_aud >= 0),
  actual_cost_aud numeric NOT NULL DEFAULT 0 CHECK (actual_cost_aud >= 0),
  benchmark_version text,
  sample_size integer NOT NULL DEFAULT 0,
  precision_at_10 numeric,
  recall_at_10 numeric,
  false_positive_rate numeric,
  community_benefit_score numeric,
  findings text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (initiative_id, name)
);

CREATE INDEX IF NOT EXISTS idx_act_research_experiments_initiative
  ON public.act_research_experiments (initiative_id, status, created_at DESC);

ALTER TABLE public.act_research_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.act_research_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads ACT research initiatives"
  ON public.act_research_initiatives FOR SELECT USING (true);
CREATE POLICY "Public reads ACT research experiments"
  ON public.act_research_experiments FOR SELECT USING (true);
CREATE POLICY "Service role manages ACT research initiatives"
  ON public.act_research_initiatives FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages ACT research experiments"
  ON public.act_research_experiments FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.act_research_initiatives (
  slug,
  title,
  purpose,
  status,
  current_phase,
  budget_cap_aud,
  community_benefit_commitment,
  governance_principles,
  success_metrics,
  stop_conditions,
  next_decision,
  evidence_urls
) VALUES (
  'community-opportunity-intelligence',
  'Community Opportunity Intelligence Commons',
  'Test whether transparent search, extraction and evaluation systems can help ACT projects and under-seen communities find relevant resources without creating another noisy grant directory.',
  'benchmarking',
  1,
  250,
  'Methods, benchmark definitions and non-sensitive findings remain open. Community-defined need and authority must shape ranking; extraction from communities must not become surveillance or replace consent.',
  ARRAY[
    'community benefit before model novelty',
    'evidence before recommendation',
    'human authority before pipeline action',
    'open methods and reproducible evaluation',
    'small reversible experiments',
    'no token speculation from the research budget'
  ],
  '{
    "precision_at_10_min": 0.80,
    "false_positive_rate_max": 0.10,
    "official_source_coverage_min": 0.95,
    "community_benefit_score_min": 0.70,
    "cost_per_reviewable_signal_aud_max": 2.00
  }'::jsonb,
  ARRAY[
    'provider cannot return source evidence',
    'false-positive rate remains above 10 percent after two iterations',
    'community-controlled organisations are systematically ranked below incumbents',
    'cost exceeds the approved cap',
    'the experiment requires purchasing or staking a speculative asset'
  ],
  'Build the reviewed ACT opportunity benchmark and compare direct feeds, Octen and an open-source baseline before approving any external network spend.',
  ARRAY[
    'https://docs.learnbittensor.org/subnets/walkthrough-prompting',
    'https://docs.crawl4ai.com/',
    'https://github.com/searxng/searxng'
  ]
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  purpose = EXCLUDED.purpose,
  community_benefit_commitment = EXCLUDED.community_benefit_commitment,
  governance_principles = EXCLUDED.governance_principles,
  success_metrics = EXCLUDED.success_metrics,
  stop_conditions = EXCLUDED.stop_conditions,
  next_decision = EXCLUDED.next_decision,
  evidence_urls = EXCLUDED.evidence_urls,
  updated_at = now();

INSERT INTO public.act_research_experiments (
  initiative_id, name, provider, hypothesis, status, budget_cap_aud, benchmark_version
)
SELECT id, experiment.name, experiment.provider, experiment.hypothesis, experiment.status, experiment.budget, 'act-opportunity-v1'
FROM public.act_research_initiatives
CROSS JOIN (VALUES
  ('Direct official sources baseline', 'official-feeds', 'Official feeds and watched funder pages provide the highest precision baseline.', 'planned', 0::numeric),
  ('Octen discovery pilot', 'octen', 'Targeted concurrent search improves recall without increasing false positives after the evidence gate.', 'planned', 50::numeric),
  ('Open retrieval baseline', 'searxng+crawl4ai', 'Self-hosted metasearch and extraction can approach paid-provider quality at low marginal cost.', 'planned', 50::numeric),
  ('Multi-provider tournament', 'provider-ensemble', 'Blind evaluation can route each query to the cheapest provider that meets the quality floor.', 'planned', 50::numeric),
  ('Bittensor testnet challenge', 'bittensor-testnet', 'Competing miners can improve discovery diversity when validators reward evidence and community benefit.', 'planned', 100::numeric)
) AS experiment(name, provider, hypothesis, status, budget)
WHERE slug = 'community-opportunity-intelligence'
ON CONFLICT (initiative_id, name) DO NOTHING;


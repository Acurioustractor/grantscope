create table if not exists public.wa_transition_candidates (
  id uuid primary key default gen_random_uuid(),
  state_tender_id uuid not null unique references public.state_tenders(id) on delete cascade,
  source_contract_id text not null,
  service_family text not null,
  candidate_status text not null,
  relevance_score integer not null default 0,
  positive_signals text[] not null default '{}',
  exclusion_signals text[] not null default '{}',
  classification_method text not null default 'rules',
  classifier_version text not null,
  evidence_status text not null default 'inferred',
  review_status text not null default 'pending',
  is_kimberley boolean not null default false,
  transition_window text not null default 'unknown',
  matched_entity_id uuid references public.gs_entities(id) on delete set null,
  entity_match_status text not null default 'unmatched',
  entity_match_method text,
  entity_match_confidence numeric(4, 3),
  supplier_is_community_controlled boolean,
  entity_match_evidence jsonb not null default '{}'::jsonb,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wa_transition_candidates_service_family_check check (
    service_family in (
      'youth_justice', 'child_family', 'housing_homelessness',
      'health_mental_health', 'disability', 'family_domestic_violence',
      'employment_training', 'community_services', 'cultural_services', 'other'
    )
  ),
  constraint wa_transition_candidates_candidate_status_check check (
    candidate_status in ('candidate', 'review', 'excluded')
  ),
  constraint wa_transition_candidates_evidence_status_check check (
    evidence_status in ('inferred', 'verified', 'unknown', 'excluded')
  ),
  constraint wa_transition_candidates_review_status_check check (
    review_status in ('pending', 'confirmed', 'excluded', 'disputed')
  ),
  constraint wa_transition_candidates_transition_window_check check (
    transition_window in ('expired', 'ending_12m', 'ending_24m', 'later', 'unknown')
  ),
  constraint wa_transition_candidates_entity_match_status_check check (
    entity_match_status in ('matched', 'ambiguous', 'unmatched', 'panel')
  ),
  constraint wa_transition_candidates_relevance_score_check check (
    relevance_score between 0 and 100
  )
);

comment on table public.wa_transition_candidates is
  'Auditable, review-first classification of WA tender records for possible human-service transition analysis. Candidate status is not a readiness, authority, demand or engagement decision.';
comment on column public.wa_transition_candidates.supplier_is_community_controlled is
  'Copied signal from a uniquely matched CivicGraph entity. Null means unresolved; true is not a CASWA-approved register determination.';
comment on column public.wa_transition_candidates.is_kimberley is
  'True only when the source-published Tenders WA regions include Kimberley.';

create index if not exists idx_wa_transition_candidates_status
  on public.wa_transition_candidates(candidate_status, review_status);
create index if not exists idx_wa_transition_candidates_family
  on public.wa_transition_candidates(service_family);
create index if not exists idx_wa_transition_candidates_kimberley
  on public.wa_transition_candidates(is_kimberley, candidate_status);
create index if not exists idx_wa_transition_candidates_window
  on public.wa_transition_candidates(transition_window, candidate_status);
create index if not exists idx_wa_transition_candidates_entity
  on public.wa_transition_candidates(matched_entity_id);

grant all on public.wa_transition_candidates to service_role;

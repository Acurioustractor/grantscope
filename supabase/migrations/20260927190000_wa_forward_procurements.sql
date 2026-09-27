create table if not exists public.wa_forward_procurements (
  id uuid primary key default gen_random_uuid(),
  source_ref text not null,
  parent_agency text not null,
  buying_agency text not null,
  lead_delivery_agency text,
  title text not null,
  procurement_type text,
  unspsc_code text,
  unspsc_title text,
  delivery_point text,
  release_financial_year text,
  release_quarter text,
  estimated_term_months integer,
  estimated_value_band text,
  agency_contact text,
  existing_contract_number text,
  matched_state_tender_id uuid references public.state_tenders(id) on delete set null,
  existing_contract_match_status text not null default 'not_supplied',
  review_classification text not null default 'unreviewed',
  review_reason text,
  evidence_status text not null default 'verified_public_display',
  source_owner_page_url text not null,
  source_report_url text not null,
  source_refreshed_on date,
  captured_at timestamptz not null,
  capture_method text not null,
  capture_filters jsonb not null default '{}'::jsonb,
  source_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_ref, source_refreshed_on),
  constraint wa_forward_procurements_match_status_check check (
    existing_contract_match_status in ('not_supplied', 'matched', 'unmatched', 'ambiguous')
  ),
  constraint wa_forward_procurements_review_classification_check check (
    review_classification in ('human_services_review', 'source_classification_anomaly', 'unreviewed')
  ),
  constraint wa_forward_procurements_evidence_status_check check (
    evidence_status in ('verified_public_display', 'authorised_extract', 'inferred', 'unknown')
  )
);

comment on table public.wa_forward_procurements is
  'Forward procurement plans captured from an official WA public report. A plan is not an award, guaranteed tender, transition decision or invitation to engage.';
comment on column public.wa_forward_procurements.review_classification is
  'GrantScope review routing only. It preserves apparent source anomalies and does not alter the source-published procurement type.';
comment on column public.wa_forward_procurements.matched_state_tender_id is
  'Exact reference link to a published historical contract when the source supplies an existing contract number. Null is an explicit valid state.';

create index if not exists idx_wa_forward_procurements_region_type
  on public.wa_forward_procurements(delivery_point, procurement_type);
create index if not exists idx_wa_forward_procurements_release_year
  on public.wa_forward_procurements(release_financial_year);
create index if not exists idx_wa_forward_procurements_existing_contract
  on public.wa_forward_procurements(existing_contract_number)
  where existing_contract_number is not null;

grant all on public.wa_forward_procurements to service_role;

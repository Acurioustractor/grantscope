-- Structured evidence events for accountability trackers.
-- Purpose: move tracker source chains out of hardcoded page arrays and into
-- a reusable table keyed by jurisdiction + tracker.

CREATE TABLE IF NOT EXISTS tracker_evidence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  jurisdiction text NOT NULL,
  tracker_key text NOT NULL,
  stage text NOT NULL,
  event_date date NOT NULL,
  title text NOT NULL,
  summary text,
  source_kind text NOT NULL,
  source_name text,
  source_url text,
  provider_name text,
  site_names text[] NOT NULL DEFAULT '{}'::text[],
  evidence_strength text NOT NULL DEFAULT 'official',
  mirror_status text NOT NULL DEFAULT 'not_applicable',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracker_evidence_events_unique
    UNIQUE (domain, jurisdiction, tracker_key, stage, event_date, title)
);

CREATE INDEX IF NOT EXISTS idx_tracker_evidence_events_lookup
  ON tracker_evidence_events(domain, jurisdiction, tracker_key, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_tracker_evidence_events_stage
  ON tracker_evidence_events(domain, jurisdiction, tracker_key, stage, event_date DESC);

DROP TRIGGER IF EXISTS tracker_evidence_events_updated_at ON tracker_evidence_events;
CREATE TRIGGER tracker_evidence_events_updated_at
  BEFORE UPDATE ON tracker_evidence_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO tracker_evidence_events (
  domain,
  jurisdiction,
  tracker_key,
  stage,
  event_date,
  title,
  summary,
  source_kind,
  source_name,
  source_url,
  provider_name,
  site_names,
  evidence_strength,
  mirror_status,
  metadata
)
VALUES
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'promise',
    DATE '2024-12-10',
    'Hansard promise names Ohana and Men of Business',
    'Parliamentary debate records two Youth Justice Schools via Ohana for Youth and four early intervention schools, including Men of Business on the Gold Coast.',
    'hansard',
    'Queensland Parliament Hansard',
    'https://documents.parliament.qld.gov.au/events/han/2024/2024_12_10_WEEKLY.pdf',
    NULL,
    ARRAY['Gold Coast', 'Ipswich', 'Townsville', 'Rockhampton'],
    'official',
    'external_only',
    jsonb_build_object(
      'quoted_operators', jsonb_build_array('Ohana for Youth', 'Men of Business'),
      'package_note', 'two youth justice schools and four early intervention schools'
    )
  ),
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'statement',
    DATE '2025-06-23',
    'Government singles out Men of Business and says tenders will follow',
    'Official statement says $50M over five years for four Crime Prevention Schools, with Men of Business first and tenders later for Townsville, Rockhampton, and Ipswich.',
    'ministerial_statement',
    'Queensland Ministerial Media Statements',
    'https://statements.qld.gov.au/statements/102828',
    'Men of Business Academy',
    ARRAY['Gold Coast', 'Townsville', 'Rockhampton', 'Ipswich'],
    'official',
    'mirrored',
    jsonb_build_object('budget_commitment', 50000000, 'first_operator', 'Men of Business Academy')
  ),
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'budget',
    DATE '2025-06-24',
    'Budget envelope confirms the early intervention spend',
    'Budget statement places Crime Prevention Schools inside the broader early intervention youth justice funding package.',
    'ministerial_statement',
    'Queensland Ministerial Media Statements',
    'https://statements.qld.gov.au/statements/102882',
    NULL,
    ARRAY['Queensland'],
    'official',
    'external_only',
    jsonb_build_object('budget_line', '$215M early intervention package')
  ),
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'qon',
    DATE '2025-06-25',
    'Question on Notice 769 confirms procurement process for the remaining three sites',
    'Official answer says Men of Business is first and the department will undertake a procurement process and call for tenders for Townsville, Rockhampton, and Ipswich.',
    'question_on_notice',
    'Queensland Parliament Questions on Notice',
    'https://documents.parliament.qld.gov.au/tableoffice/questionsanswers/2025/769-2025.pdf',
    'Men of Business Academy',
    ARRAY['Townsville', 'Rockhampton', 'Ipswich'],
    'official',
    'external_only',
    jsonb_build_object('question_number', 769, 'year', 2025)
  ),
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'estimates',
    DATE '2025-08-05',
    'Committee hearing restates Ohana delivery pathway',
    'Estimates hearing records Ohana as the Youth Justice School service provider and places the schools inside the committee-answered funding narrative.',
    'estimates_hearing',
    'Justice, Integrity and Community Safety Committee',
    'https://documents.parliament.qld.gov.au/com/JICSC-CD82/C20252026-CB9D/public%20hearing%2C%205%20August%202025.pdf',
    'Ohana for Youth',
    ARRAY['South-East Queensland', 'North Queensland'],
    'official',
    'external_only',
    jsonb_build_object('hearing_date', '2025-08-05')
  ),
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'tender_trace',
    DATE '2025-08-29',
    'QTenders / VendorPanel trace appears for Crime Prevention Schools',
    'Public EOI trace for VP476087 shows an open provider process signal, even though that row is not yet mirrored in CivicGraph state tenders.',
    'qtenders_trace',
    'QTenders / VendorPanel',
    'https://qtenders.epw.qld.gov.au/qtenders/tender/display/tender-details.do?action=display-tender-details&id=55096',
    NULL,
    ARRAY['Townsville', 'Rockhampton', 'Ipswich'],
    'public_trace',
    'missing_from_mirror',
    jsonb_build_object('source_id', 'VP476087', 'model', 'Special Assistance School')
  ),
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'award_trace',
    DATE '2025-10-01',
    'Ohana appears in the DYJVS contract disclosure feed',
    'The local tender mirror carries an awarded OHANA EDUCATION LTD row worth $1.65M from the Department of Youth Justice and Victim Services.',
    'state_tenders',
    'Department of Youth Justice and Victim Services disclosure',
    'https://www.families.qld.gov.au/_media/documents/open-data/dyjvs-contract-disclosure-oct-2025.csv',
    'OHANA EDUCATION LTD',
    ARRAY['Logan', 'Cairns'],
    'mirror',
    'mirrored',
    jsonb_build_object('contract_value', 1650000, 'status', 'awarded')
  ),
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'mirror_gap',
    DATE '2025-10-01',
    'Men of Business has no local tender-mirror supplier row yet',
    'CivicGraph currently has no state_tenders supplier row for Men of Business against the Crime Prevention Schools chain, even though the organisation is publicly named.',
    'state_tenders_gap',
    'CivicGraph state_tenders mirror',
    NULL,
    'Men of Business Academy',
    ARRAY['Gold Coast'],
    'mirror_gap',
    'missing_from_mirror',
    jsonb_build_object('expected_evidence', 'supplier row or award trace')
  ),
  (
    'youth-justice',
    'QLD',
    'crime-prevention-schools',
    'rollout_statement',
    DATE '2026-02-04',
    'Logan rollout names Ohana for Youth',
    'Official statement says Ohana for Youth will operate the Logan Youth Justice School and a second Cairns site is underway.',
    'ministerial_statement',
    'Queensland Ministerial Media Statements',
    'https://statements.qld.gov.au/statements/104436',
    'Ohana for Youth',
    ARRAY['Logan', 'Cairns'],
    'official',
    'mirrored',
    jsonb_build_object('rollout_sites', jsonb_build_array('Logan', 'Cairns'))
  )
ON CONFLICT (domain, jurisdiction, tracker_key, stage, event_date, title)
DO UPDATE SET
  summary = EXCLUDED.summary,
  source_kind = EXCLUDED.source_kind,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  provider_name = EXCLUDED.provider_name,
  site_names = EXCLUDED.site_names,
  evidence_strength = EXCLUDED.evidence_strength,
  mirror_status = EXCLUDED.mirror_status,
  metadata = EXCLUDED.metadata,
  updated_at = now();

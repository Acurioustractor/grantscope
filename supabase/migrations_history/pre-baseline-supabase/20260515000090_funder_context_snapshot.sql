-- P10: Funder context snapshot.
--
-- Per-funder dossier pulled from every system that knows about funders:
--   - foundations               → annual giving, themes, geo
--   - ghl_contacts              → ACT's people at this funder
--   - foundation_grantees       → who they've previously funded
--   - xero_invoices / payments  → real $ relationship ACT ↔ funder
--   - notion_organizations      → presence in ACT's Notion
--   - act_grant_recommendation_decisions → past triage outcomes per funder
--   - gmail_messages (future)   → email history (currently empty, gets filled by MCP enrichment)
--
-- Snapshot refreshed by scripts/refresh-funder-context.mjs (run nightly).
-- UI on /ops/grant-recommendations + /triage reads from this table.

CREATE TABLE IF NOT EXISTS funder_context_snapshot (
  funder_name text PRIMARY KEY,
  funder_aliases text[] NOT NULL DEFAULT '{}'::text[],

  -- Foundation profile (from `foundations`)
  foundation_id uuid REFERENCES foundations(id) ON DELETE SET NULL,
  abn text,
  annual_giving numeric,
  thematic_focus text[],
  geographic_focus text[],
  website text,

  -- ACT's contacts at this funder (from ghl_contacts)
  contacts_count integer NOT NULL DEFAULT 0,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{name, email, last_contact_date}]
  most_recent_contact_at timestamptz,

  -- Past grantees (from foundation_grantees)
  grantee_count integer NOT NULL DEFAULT 0,
  recent_grantees text[] NOT NULL DEFAULT '{}'::text[],

  -- Xero financial flow (ACT ↔ funder)
  xero_invoiced_total numeric NOT NULL DEFAULT 0,
  xero_paid_total numeric NOT NULL DEFAULT 0,
  xero_authorised_total numeric NOT NULL DEFAULT 0,
  xero_last_invoice_date date,
  xero_last_payment_date date,

  -- Notion presence
  notion_org_id text,
  notion_org_name text,

  -- Past ACT decisions on this funder (counts by decision state)
  decisions jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_decisions integer NOT NULL DEFAULT 0,

  -- Email (Gmail MCP enrichment — filled later)
  email_count integer NOT NULL DEFAULT 0,
  email_last_date timestamptz,
  email_summary text,

  -- Composite "relationship strength" 0-100
  -- 40 from xero $ + 20 from contacts recency + 20 from past decisions + 20 from grantee count
  relationship_score integer NOT NULL DEFAULT 0,

  refreshed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funder_context_score
  ON funder_context_snapshot (relationship_score DESC);
CREATE INDEX IF NOT EXISTS idx_funder_context_recent_contact
  ON funder_context_snapshot (most_recent_contact_at DESC NULLS LAST);

COMMENT ON TABLE funder_context_snapshot IS
  'Per-funder dossier — pulled from foundations + ghl_contacts + xero + notion + decisions. Refreshed by scripts/refresh-funder-context.mjs.';

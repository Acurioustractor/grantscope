-- Goods impact-$ traceability: tranche register derived from Xero, plus the
-- framing column for funder ask-framing (synced from act-infra funders.json).
-- Idempotent: re-running refreshes tranche amounts from xero_invoices.

BEGIN;

CREATE TABLE IF NOT EXISTS goods_tranches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id      uuid REFERENCES goods_relationships(id) ON DELETE SET NULL,
  funder_name          text NOT NULL,
  xero_invoice_number  text UNIQUE,
  amount_aud           numeric NOT NULL,
  invoice_date         date,
  funding_track        text CHECK (funding_track IN ('grant','investment','procurement','support')),
  purpose              text,
  -- Which deployments this tranche funded: curated, e.g.
  -- {"communities": [{"id": "palm-island", "beds": 40}], "note": "..."}
  allocation           jsonb,
  source               text NOT NULL DEFAULT 'xero',
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goods_tranches_relationship ON goods_tranches(relationship_id);

COMMENT ON TABLE goods_tranches IS
  'Funder -> tranche (Xero invoice) -> deployment traceability. Amounts come from xero_invoices (project_code ACT-GD, paid ACCREC); allocation to communities/assets is curated.';

ALTER TABLE goods_relationships
  ADD COLUMN IF NOT EXISTS framing jsonb;

COMMENT ON COLUMN goods_relationships.framing IS
  'Per-funder ask framing synced from act-global-infrastructure wiki/narrative/funders.json: {tone, framing_notes, claims_to_lead_with, claims_to_avoid, slug, synced_at}.';

-- Seed/refresh tranches straight from Xero (the source of truth for $).
-- funding_track is a best-guess CASE pending founder verification:
--   grant = known philanthropic funders; everything else defaults to procurement.
INSERT INTO goods_tranches (relationship_id, funder_name, xero_invoice_number, amount_aud, invoice_date, funding_track, source)
SELECT
  (
    SELECT gr.id FROM goods_relationships gr
    WHERE lower(regexp_replace(gr.display_name, '^the\s+', '', 'i')) =
          lower(regexp_replace(x.contact_name, '^the\s+', '', 'i'))
       OR lower(gr.display_name) LIKE '%' || lower(regexp_replace(x.contact_name, '^the\s+', '', 'i')) || '%'
    ORDER BY gr.warmth_display DESC
    LIMIT 1
  ),
  x.contact_name,
  x.invoice_number,
  x.amount_paid,
  x.date,
  CASE
    WHEN x.contact_name ILIKE '%snow%'
      OR x.contact_name ILIKE '%centrecorp%'
      OR x.contact_name ILIKE '%fairfax%'
      OR x.contact_name ILIKE '%villiers%'
    THEN 'grant'
    ELSE 'procurement'  -- TODO(ben-verify): QIC, Red Dust, Julalikari, Mala'la, Our Community Shed
  END,
  'xero'
FROM xero_invoices x
WHERE x.project_code = 'ACT-GD'
  AND x.type = 'ACCREC'
  AND x.status NOT IN ('DELETED','VOIDED')
  AND x.amount_paid > 0
ON CONFLICT (xero_invoice_number) DO UPDATE
  SET amount_aud = EXCLUDED.amount_aud,
      invoice_date = EXCLUDED.invoice_date,
      updated_at = now();

COMMIT;

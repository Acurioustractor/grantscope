-- NDIS Commission Compliance Actions
-- Source: data.gov.au - NDIS Quality and Safeguards Commission
-- 2,328 enforcement actions against NDIS providers (banning orders, compliance notices, etc.)
-- ABN-keyed: links to gs_entities and ndis_registered_providers

CREATE TABLE IF NOT EXISTS ndis_compliance_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    date_effective TIMESTAMPTZ,
    date_no_longer_in_force TIMESTAMPTZ,
    provider_name TEXT NOT NULL,
    abn TEXT,
    city TEXT,
    state TEXT,
    postcode TEXT,
    provider_number TEXT,
    registration_groups TEXT,
    relevant_information TEXT,
    other_relevant_info TEXT,
    gs_entity_id UUID REFERENCES gs_entities(id),
    source_url TEXT DEFAULT 'https://data.gov.au/dataset/ndis-commission-compliance-actions-24-03-2026',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(action_type, provider_name, date_effective)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ndis_compliance_abn ON ndis_compliance_actions(abn);
CREATE INDEX IF NOT EXISTS idx_ndis_compliance_type ON ndis_compliance_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_ndis_compliance_state ON ndis_compliance_actions(state);
CREATE INDEX IF NOT EXISTS idx_ndis_compliance_date ON ndis_compliance_actions(date_effective);
CREATE INDEX IF NOT EXISTS idx_ndis_compliance_entity ON ndis_compliance_actions(gs_entity_id);

-- Enable RLS (disabled for now -- read-only public data)
-- ALTER TABLE ndis_compliance_actions ENABLE ROW LEVEL SECURITY;

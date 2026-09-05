-- State-level political donation disclosures
-- Extends political_donations with state-level data (QLD first, then NSW, VIC)

-- Add source_state column to distinguish federal vs state donations
ALTER TABLE political_donations ADD COLUMN IF NOT EXISTS source_state TEXT DEFAULT 'federal';

-- Create index for state-level queries
CREATE INDEX IF NOT EXISTS idx_political_donations_source_state ON political_donations (source_state);

-- QLD donations will use source_state = 'QLD'
-- NSW donations will use source_state = 'NSW'
-- VIC donations will use source_state = 'VIC'
-- Federal (AEC) donations keep source_state = 'federal'

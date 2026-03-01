-- Add program_type to foundation_programs and grant_opportunities
-- Distinguishes: grant, fellowship, award, scholarship, program, other

ALTER TABLE foundation_programs
  ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'grant';

ALTER TABLE grant_opportunities
  ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'grant';

CREATE INDEX IF NOT EXISTS idx_foundation_programs_type ON foundation_programs(program_type);
CREATE INDEX IF NOT EXISTS idx_grant_opportunities_program_type ON grant_opportunities(program_type);

COMMENT ON COLUMN foundation_programs.program_type IS 'grant, fellowship, award, scholarship, program, other';
COMMENT ON COLUMN grant_opportunities.program_type IS 'grant, fellowship, award, scholarship, program, other';

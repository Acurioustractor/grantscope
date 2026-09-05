-- Revolving Door Analysis: People who sit on multiple charity boards
-- that both donate to politics AND receive government contracts

-- View: People on multiple boards (cross-charity board memberships)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_multi_board_persons AS
SELECT
  pr.person_name_normalised,
  pr.person_name,
  COUNT(DISTINCT pr.company_abn) as board_count,
  ARRAY_AGG(DISTINCT pr.company_name ORDER BY pr.company_name) as organisations,
  ARRAY_AGG(DISTINCT pr.company_abn ORDER BY pr.company_abn) as organisation_abns,
  ARRAY_AGG(DISTINCT pr.role_type ORDER BY pr.role_type) as roles
FROM person_roles pr
WHERE pr.source = 'acnc'
GROUP BY pr.person_name_normalised, pr.person_name
HAVING COUNT(DISTINCT pr.company_abn) >= 2
ORDER BY board_count DESC;

CREATE INDEX IF NOT EXISTS idx_mv_multi_board_persons_count
  ON mv_multi_board_persons (board_count DESC);

-- View: Board members whose organisations are also political donors
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_board_donor_links AS
SELECT
  pr.person_name,
  pr.person_name_normalised,
  pr.company_name,
  pr.company_abn,
  pr.role_type,
  d.total_donated,
  d.donation_count,
  d.parties
FROM person_roles pr
JOIN (
  SELECT
    donor_abn,
    SUM(amount) as total_donated,
    COUNT(*) as donation_count,
    ARRAY_AGG(DISTINCT donation_to) as parties
  FROM political_donations
  WHERE donor_abn IS NOT NULL
  GROUP BY donor_abn
) d ON d.donor_abn = pr.company_abn
WHERE pr.source = 'acnc'
ORDER BY d.total_donated DESC;

CREATE INDEX IF NOT EXISTS idx_mv_board_donor_links_abn
  ON mv_board_donor_links (company_abn);

-- View: Board members whose organisations hold government contracts
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_board_contractor_links AS
SELECT
  pr.person_name,
  pr.person_name_normalised,
  pr.company_name,
  pr.company_abn,
  pr.role_type,
  c.total_contracts,
  c.contract_count,
  c.departments
FROM person_roles pr
JOIN (
  SELECT
    supplier_abn,
    SUM(contract_value) as total_contracts,
    COUNT(*) as contract_count,
    ARRAY_AGG(DISTINCT buyer_name) as departments
  FROM austender_contracts
  WHERE supplier_abn IS NOT NULL
    AND contract_value > 10000
  GROUP BY supplier_abn
) c ON c.supplier_abn = pr.company_abn
WHERE pr.source = 'acnc'
ORDER BY c.total_contracts DESC;

CREATE INDEX IF NOT EXISTS idx_mv_board_contractor_links_abn
  ON mv_board_contractor_links (company_abn);

-- The money shot: People who sit on boards of organisations that BOTH
-- donate to politics AND hold government contracts
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_revolving_door AS
SELECT
  bd.person_name,
  bd.person_name_normalised,
  bd.company_name,
  bd.company_abn,
  bd.role_type,
  bd.total_donated,
  bd.donation_count,
  bd.parties,
  bc.total_contracts,
  bc.contract_count,
  bc.departments,
  CASE WHEN bd.total_donated > 0 THEN
    ROUND(bc.total_contracts / bd.total_donated, 1)
  ELSE 0 END as roi_multiple,
  -- Check if person sits on multiple boards
  mb.board_count,
  mb.organisations as other_boards
FROM mv_board_donor_links bd
JOIN mv_board_contractor_links bc
  ON bc.company_abn = bd.company_abn
  AND bc.person_name_normalised = bd.person_name_normalised
LEFT JOIN mv_multi_board_persons mb
  ON mb.person_name_normalised = bd.person_name_normalised
ORDER BY bc.total_contracts DESC;

CREATE INDEX IF NOT EXISTS idx_mv_revolving_door_person
  ON mv_revolving_door (person_name_normalised);

CREATE INDEX IF NOT EXISTS idx_mv_revolving_door_abn
  ON mv_revolving_door (company_abn);

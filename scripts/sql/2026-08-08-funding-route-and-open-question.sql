-- Record how each project is funded, and surface the question blocking its ranking.
-- Applied via Supabase MCP.
--
-- WHY A ROUTE COLUMN
--
-- CivicGraph and ACT Core show zero strong grant fits, and that is correct rather
-- than broken. Across the 2,369 open grants: open data / civic tech appears in 2,
-- capacity building / core costs in 20. CivicGraph's route is buyers —
-- docs/strategy/buyer-wedge.md already says so — and ACT Core is studio overhead,
-- which grants rarely fund.
--
-- Left unrecorded, an empty grant list on those pages reads as a discovery failure
-- and invites someone to "fix" it by loosening the matcher, which would manufacture
-- false fits — the exact failure this whole audit has been undoing. Naming the
-- route makes the emptiness legible.
--
-- WHY next_question WAS THE MISSING PIECE
--
-- act_grant_recommendation_projects.next_question already held a real, specific
-- question for all 12 projects, written by whoever knows them, and nothing read it:
--
--   CivicGraph  Which query mode becomes the first repeatable paid product?
--   ACT Core    Which blockers must be resolved before large funds such as SEQ IEF
--               or CRC-P are pursued?
--   Contained   Which funder brief needs Contained as the experience layer and
--               CivicGraph as the evidence layer?
--   Harvest     Which opportunities need the lease/entity decision resolved first?
--   PICC        Which opportunities should be partner-led by community organisations?
--
-- A recommender that says "I cannot rank these until you answer X" is worth more
-- than one that guesses past it. Guessing past it is how 1,005 foundation matches
-- ended up ranked on invented money.

ALTER TABLE act_grant_recommendation_projects
  ADD COLUMN IF NOT EXISTS primary_funding_route text
  CHECK (primary_funding_route IN ('grants', 'buyers', 'overhead', 'earned', 'mixed'));

COMMENT ON COLUMN act_grant_recommendation_projects.primary_funding_route IS
  'How this project is actually funded. Where this is not ''grants'', an empty grant list is the expected result, not a defect — the UI says so rather than leaving the absence unexplained.';

UPDATE act_grant_recommendation_projects SET primary_funding_route = CASE project_code
  WHEN 'ACT-CS'   THEN 'buyers'    -- SE-registry buyer wedge; 2 candidate grants exist in total
  WHEN 'ACT-CORE' THEN 'overhead'  -- governance and operating model, funded from margin
  WHEN 'ACT-GD'   THEN 'mixed'     -- Goods sells as well as applies
  ELSE 'grants'
END;

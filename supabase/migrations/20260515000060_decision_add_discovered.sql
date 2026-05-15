-- Allow 'discovered' as a decision state. Used by the Notion sync when
-- --include-undecided mode creates Notion pages for strong-fit recommendations
-- that haven't been actioned by an admin yet. The page already exists in
-- Notion under "Grant Opportunity Identified" stage so the row needs a stable
-- decision value to upsert the notion_page_id back.

ALTER TABLE act_grant_recommendation_decisions
  DROP CONSTRAINT IF EXISTS act_grant_recommendation_decisions_decision_check;

ALTER TABLE act_grant_recommendation_decisions
  ADD CONSTRAINT act_grant_recommendation_decisions_decision_check
  CHECK (decision IN (
    'discovered','pursuing','watching','passed','applied','submitted','won','lost'
  ));

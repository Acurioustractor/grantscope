-- Add ACT org-level leadership (not project-scoped)
-- These show on the main /org/act page

BEGIN;

INSERT INTO org_leadership (org_profile_id, name, title, bio, external_roles, sort_order)
VALUES
(
  '8b6160a1-7eea-4bd2-8404-71c196381de0',
  'Nicholas Marchesi OAM',
  'Co-Founder & Director',
  'Young Australian of the Year 2016. Co-founder of Orange Sky (now Australia''s largest mobile laundry service). Creative director, storyteller, and community builder. Leads ACT''s creative practice, community partnerships, and The Harvest venue.',
  '[{"org": "A Kind Tractor LTD", "role": "Director & Secretary"}, {"org": "Orange Sky Australia", "role": "Co-Founder"}]',
  1
),
(
  '8b6160a1-7eea-4bd2-8404-71c196381de0',
  'Benjamin Knight',
  'Co-Founder & Director',
  'Systems architect and social enterprise technologist. Builds decision infrastructure for government and community sectors. Leads ACT''s technology portfolio including JusticeHub, CivicGraph, Empathy Ledger, and the agentic AI platform.',
  '[{"org": "A Kind Tractor LTD", "role": "Director"}, {"org": "CivicGraph", "role": "Founder"}]',
  2
),
(
  '8b6160a1-7eea-4bd2-8404-71c196381de0',
  'Jessica Adams',
  'Director',
  'A Kind Tractor LTD board director. Provides governance oversight and strategic guidance across the ACT ecosystem.',
  '[{"org": "A Kind Tractor LTD", "role": "Director"}]',
  3
);

COMMIT;

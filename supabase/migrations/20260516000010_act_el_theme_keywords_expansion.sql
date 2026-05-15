-- ACT-EL (Empathy Ledger) theme_keywords expansion
--
-- Problem: ACT-EL had 0 strong fits despite scoring against 553 opportunities.
-- Root cause: of 11 existing keywords, only 'arts' had data matches (149 opps).
-- 'storytelling', 'narrative', 'voice', 'listen', 'amplify', 'communication',
-- 'media', 'journalism', 'documentary' — all zero matches in focus_areas/keywords
-- columns of alma_funding_opportunities. The MV scores theme by tag-array match,
-- not description, so these words rarely land.
--
-- Fix: expand keywords to terms that actually appear as tags in the dataset
-- (verified via tag-frequency scan), while keeping the conceptual intent
-- (storytelling, voice amplification, especially First Nations narratives,
-- cultural identity, rights-based work).
--
-- Expected lift: 0 strong fits → ~49 (per simulation, before MV refresh).

UPDATE act_grant_recommendation_projects
SET
  theme_keywords = ARRAY[
    'arts',
    'indigenous',
    'aboriginal',
    'culture',
    'cultural',
    'heritage',
    'stories',
    'storytelling',
    'narrative',
    'voice',
    'first nations',
    'diversity',
    'human_rights',
    'human rights',
    'identity',
    'language',
    'creative',
    'social-justice',
    'inclusion_equality'
  ],
  updated_at = now()
WHERE project_code = 'ACT-EL';

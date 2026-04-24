DROP TABLE IF EXISTS tmp_act_project_foundation_followups;
CREATE TEMP TABLE tmp_act_project_foundation_followups (
  project_slug TEXT NOT NULL,
  foundation_id UUID NOT NULL,
  engagement_status TEXT NOT NULL,
  last_interaction_at TIMESTAMPTZ,
  next_touch_at TIMESTAMPTZ,
  next_touch_note TEXT,
  interaction_type TEXT,
  interaction_summary TEXT,
  interaction_notes TEXT,
  interaction_happened_at TIMESTAMPTZ
);

INSERT INTO tmp_act_project_foundation_followups (
  project_slug,
  foundation_id,
  engagement_status,
  last_interaction_at,
  next_touch_at,
  next_touch_note,
  interaction_type,
  interaction_summary,
  interaction_notes,
  interaction_happened_at
)
VALUES
  (
    'justicehub',
    '8f8704be-d6e8-40f3-b561-ac6630ce5b36'::uuid,
    'ready_to_approach',
    NULL,
    '2026-04-21 10:00:00+10'::timestamptz,
    'Finish the tailored Minderoo brief and request the first conversation with the Communities lead.',
    NULL,
    NULL,
    NULL,
    NULL
  ),
  (
    'justicehub',
    '4ee5baca-c898-4318-ae2b-d79b95379cc7'::uuid,
    'approached',
    '2026-04-17 09:30:00+10'::timestamptz,
    '2026-04-22 14:00:00+10'::timestamptz,
    'Follow up on the intro note with a one-geography PRF demo concept.',
    'email',
    'ACT seed: Sent PRF intro with justice reinvestment demo angle.',
    'Shared the justice reinvestment framing and proposed a short working session around one target geography.',
    '2026-04-17 09:30:00+10'::timestamptz
  ),
  (
    'justicehub',
    'b9e090e5-1672-48ff-815a-2a6314ebe033'::uuid,
    'approached',
    '2026-03-05 11:00:00+10'::timestamptz,
    '2026-04-15 09:00:00+10'::timestamptz,
    'Re-open the Ian Potter path with a tighter Indigenous community-development evidence brief.',
    'email',
    'ACT seed: Sent Ian Potter outreach note linking JusticeHub to community-development decision support.',
    'Initial outreach was made, but the relationship now needs a refreshed brief and follow-up.',
    '2026-03-05 11:00:00+10'::timestamptz
  ),
  (
    'empathy-ledger',
    'd242967e-0e68-4367-9785-06cf0ec7485e'::uuid,
    'meeting',
    '2026-04-18 15:00:00+10'::timestamptz,
    '2026-04-24 13:00:00+10'::timestamptz,
    'Send the Snow working-session route and confirm the first live portfolio review.',
    'meeting',
    'ACT seed: Framed Snow working session around one live RHD and social determinants slice.',
    'Positioned Empathy Ledger as governed portfolio intelligence and proposed a focused working session.',
    '2026-04-18 15:00:00+10'::timestamptz
  ),
  (
    'farm',
    '5cb27568-8820-441c-a536-e88b5b4d9cea'::uuid,
    'ready_to_approach',
    NULL,
    '2026-04-23 11:30:00+10'::timestamptz,
    'Turn the Farm arts/community material into a Tim Fairfax-specific one-pager with capital/program split.',
    NULL,
    NULL,
    NULL,
    NULL
  ),
  (
    'harvest',
    '6d8356c4-8efb-471f-8bdc-46bdd85d22f1'::uuid,
    'researching',
    NULL,
    '2026-04-20 16:00:00+10'::timestamptz,
    'Draft the Harvest supplier narrative and identify the strongest Woolworths partnership entry point.',
    NULL,
    NULL,
    NULL,
    NULL
  );

DROP TABLE IF EXISTS tmp_act_project_foundation_followups_resolved;
CREATE TEMP TABLE tmp_act_project_foundation_followups_resolved AS
SELECT
  opf.id AS org_project_foundation_id,
  opf.org_profile_id,
  opf.org_project_id,
  t.engagement_status,
  t.last_interaction_at,
  t.next_touch_at,
  t.next_touch_note,
  t.interaction_type,
  t.interaction_summary,
  t.interaction_notes,
  t.interaction_happened_at
FROM tmp_act_project_foundation_followups t
JOIN org_projects op
  ON op.slug = t.project_slug
 AND op.org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0'
JOIN org_project_foundations opf
  ON opf.org_project_id = op.id
 AND opf.foundation_id = t.foundation_id;

UPDATE org_project_foundations opf
SET
  engagement_status = r.engagement_status,
  engagement_updated_at = now(),
  last_interaction_at = r.last_interaction_at,
  next_touch_at = r.next_touch_at,
  next_touch_note = r.next_touch_note,
  updated_at = now()
FROM tmp_act_project_foundation_followups_resolved r
WHERE opf.id = r.org_project_foundation_id;

DELETE FROM org_project_foundation_interactions i
USING tmp_act_project_foundation_followups_resolved r
WHERE i.org_project_foundation_id = r.org_project_foundation_id
  AND i.summary = r.interaction_summary;

INSERT INTO org_project_foundation_interactions (
  org_profile_id,
  org_project_id,
  org_project_foundation_id,
  interaction_type,
  summary,
  notes,
  happened_at,
  status_snapshot
)
SELECT
  r.org_profile_id,
  r.org_project_id,
  r.org_project_foundation_id,
  r.interaction_type,
  r.interaction_summary,
  r.interaction_notes,
  r.interaction_happened_at,
  r.engagement_status
FROM tmp_act_project_foundation_followups_resolved r
WHERE r.interaction_type IS NOT NULL;

SELECT
  COUNT(*) FILTER (WHERE engagement_status = 'ready_to_approach')::int AS ready_to_approach_rows,
  COUNT(*) FILTER (WHERE engagement_status = 'approached')::int AS approached_rows,
  COUNT(*) FILTER (WHERE engagement_status = 'meeting')::int AS meeting_rows,
  COUNT(*) FILTER (WHERE next_touch_at <= now())::int AS due_now_rows,
  COUNT(*) FILTER (WHERE next_touch_at > now())::int AS scheduled_rows
FROM tmp_act_project_foundation_followups_resolved;

-- Goods Relationship Engine — Phase 4 (frontier): director-linked + known-active + cold rows
-- 2026-06-11. Sources: mv_board_interlocks × v_acnc_grant_makers (Verified), foundations table,
-- phase-1 harvest §Unmatched (Gmail/Notion, Verified). Calendar anchors: 18 Jun Jay/Potter EOI ·
-- 26 Jun Centrecorp board + Butterfly handover · 6-7 Jul Bryan visit · 31 Aug QBE match · 8-10 Sep Philanthropy Aus conf.
BEGIN;

-- ===== A. Director-linked funder prospects (board-interlock bridges, capacity ACNC-verified) =====

INSERT INTO goods_relationships (relationship_type, display_name, stage, next_action, next_action_due, warm_intro_path, ask_amount_aud, ask_purpose, notes, source_refs) VALUES
('funder','The George Alexander Foundation','researching',
 'After the 18 Jun Potter EOI lands, ask Alberto Furlan whether GAF''s education/employment-pathways program fits a parallel application',
 '2026-06-25',
 'Shares 4+ directors with Ian Potter Foundation (Alison Watkins, Allan Myers, Paul Conroy, Kathryn North, Patrick Houlihan) — Alberto Furlan is the natural door',
 50000,
 '$50K young-people employment-pathways framing (same evidence base as the Potter EOI). Capacity verified: $2.36M grants FY23, $47M assets (v_acnc_grant_makers).',
 E'--- Phase 4 frontier (2026-06-11) --- Director-linked via mv_board_interlocks: administered alongside Ian Potter Foundation (same trustee company orbit, 4+ shared directors). Focus: education + environment, young people, pathways. Do NOT approach before the Potter EOI is in.',
 '{"phase4": {"method": "director-linked", "bridge": "Ian Potter Foundation board overlap", "verified": "v_acnc_grant_makers FY23"}}'::jsonb),

('funder','Jalara Trust','researching',
 'Research Jalara Trust (giving focus, contact) — RECOMMENDED BY ALBERTO FURLAN on the 3 Jun call alongside PRF; fold into the post-EOI Alberto thread',
 '2026-06-25',
 'Alberto Furlan (Ian Potter) explicitly recommended approaching them — ask him for the intro',
 NULL,
 'No ask yet — capacity unverified (not matched in v_acnc_grant_makers under this name; confirm legal name first).',
 E'--- Phase 4 frontier (2026-06-11) --- Named by Alberto Furlan (3 Jun call, Notion transcript — reported) as a foundation ACT should approach. Verify legal name/ABN before sizing.',
 '{"phase4": {"method": "named-referral", "bridge": "Alberto Furlan 2026-06-03", "verified": "no — name/capacity unconfirmed"}}'::jsonb),

('funder','Wunan Foundation','researching',
 'Shape an East Kimberley angle (employment + housing fit is direct); explore the Ian Trust bridge via PRF re-engagement',
 '2026-07-31',
 'Ian Trust (Wunan founder/chair) sits on the Paul Ramsay Foundation board — the PRF re-engagement IS the bridge',
 NULL,
 'No ask yet. Capacity verified: $1.26M grants FY23 (v_acnc_grant_makers). East Kimberley Indigenous development — employment, housing, education; closest thematic twin to Goods in the frontier set.',
 E'--- Phase 4 frontier (2026-06-11) --- Director-linked: Ian Trust bridges PRF ↔ Wunan (mv_board_interlocks). Wunan runs Indigenous-led employment/housing programs East Kimberley — partner-or-funder ambiguity to resolve (could be a Goods delivery partner as much as a funder).',
 '{"phase4": {"method": "director-linked", "bridge": "Ian Trust (PRF board, Wunan founder)", "verified": "v_acnc_grant_makers FY23"}}'::jsonb),

('funder','Sir David Martin Foundation','researching',
 'Frame youth-in-crisis pathways angle (Triple Care Farm lineage = young people + practical work); explore Peter Evans bridge when PRF thread re-opens',
 '2026-07-31',
 'Peter Evans sits on both PRF and Sir David Martin Foundation boards (mv_board_interlocks)',
 NULL,
 'No ask yet. Capacity verified: $3.88M grants FY23 (v_acnc_grant_makers). NSW youth-in-crisis focus — fit is youth pathways, not place; test before sizing.',
 E'--- Phase 4 frontier (2026-06-11) --- Director-linked via PRF board overlap. NSW-centric (Triple Care Farm) — geographic fit uncertain for NT/QLD work; youth-pathways framing is the only viable door.',
 '{"phase4": {"method": "director-linked", "bridge": "Peter Evans (PRF + SDMF boards)", "verified": "v_acnc_grant_makers FY23"}}'::jsonb),

('funder','Sydney Community Foundation','identified',
 'Ask Georgie Byron (Snow) whether SCF''s funds ever reach NT/remote work before investing effort — geographic mismatch risk',
 '2026-07-31',
 'Georgina Byron (Snow Foundation CEO, our deepest funder contact) sits on the Sydney Community Foundation board',
 NULL,
 'No ask. Capacity: ~$1.2-2M/yr across SCF entities (v_acnc_grant_makers FY23) but mandate is Sydney place-based — likely NOT a fit; one question to Georgie settles it.',
 E'--- Phase 4 frontier (2026-06-11) --- Director-linked (Georgina Byron). Logged for completeness; LOW priority — Sydney place-based mandate probably excludes remote NT/QLD. Considered + rejected: Viertel ($10.4M FY23 — medical research mandate), Mornington Peninsula Foundation (place mismatch).',
 '{"phase4": {"method": "director-linked", "bridge": "Georgina Byron (Snow CEO, SCF board)", "verified": "v_acnc_grant_makers FY23"}}'::jsonb),

('funder','The Bryan Education Foundation','identified',
 'Raise at the 6-7 Jul Bryan visit: does the education sister-entity co-fund alongside the main foundation?',
 '2026-07-07',
 'Michael Taylor sits on both The Bryan Foundation and Bryan Education Foundation boards; Matthew Cox is the live contact',
 NULL,
 'No separate ask — potential co-funding leg of the $150K/2yr Bryan ask (young-people pathways = education framing). One question at the visit.',
 E'--- Phase 4 frontier (2026-06-11) --- Sister entity of The Bryan Foundation (shared directors, mv_board_interlocks). Not a separate approach — a question inside the existing Bryan relationship.',
 '{"phase4": {"method": "director-linked", "bridge": "Michael Taylor (both Bryan boards)", "verified": "mv_board_interlocks"}}'::jsonb);

-- ===== B. Known-active rows (phase-1 harvest §Unmatched — real Gmail/Notion activity, no registry row) =====

INSERT INTO goods_relationships (relationship_type, display_name, stage, last_touch_at, next_action, next_action_due, notes, source_refs) VALUES
('production_partner','Defy (Sam + Will Davies)','in_conversation','2026-06-04',
 'Decide ACT''s response to Defy''s "Shared Growth?" fundraising pitch (3 Jun); Nic already brokered Ben Croft to them — clarify what ACT wants back',
 '2026-06-20',
 E'--- Phase 4 frontier (2026-06-11) --- Production partner (bed manufacturing). Contacts: Sam + Will Davies (NO "Pieter Davies" — phase-1 correction #5). Bloomfield family toured the Defy factory 4 Jun. Twist: Defy flipped to pitching ACT for THEIR own fundraising ("Shared Growth?", 3 Jun). Will Davies already on Goods Advisory Circle (org_contacts).',
 '{"phase4": {"method": "known-active", "evidence": "Gmail phase-1 harvest (verified)"}}'::jsonb),

('production_partner','Zinus (Daniel Pittman)','contacted','2025-06-15',
 'Revive the topper-v2 thread with Daniel Pittman (~12 months stale) or formally park the Zinus supply line',
 '2026-07-31',
 E'--- Phase 4 frontier (2026-06-11) --- Mattress/topper supplier thread. Email contact is Daniel Pittman, NOT Andrew (phase-1 correction #6); topper-v2 thread ~12 months stale (last_touch approximate — "12 months" per harvest, exact date unread). Pittman also listed on Goods Advisory Circle.',
 '{"phase4": {"method": "known-active", "evidence": "Gmail phase-1 harvest (verified); last_touch approximate"}}'::jsonb),

('supporter','SMART Recovery Australia','in_conversation','2026-06-09',
 'Progress the Goods/SMART drink-bottle product thread — the 9 Jun meeting surfaced ALIVE Live Well''s 6-rehab tender as the buyer channel',
 '2026-06-30',
 E'--- Phase 4 frontier (2026-06-11) --- Active collaborator: Goods/SMART drink bottle (9 Jun meeting); the mis-titled 14 Apr "AMP Ledger Platform Demo" Notion note was actually an Empathy Ledger demo to SMART Recovery (phase-1 correction #14). Josette Long on Goods Advisory Circle. $2.2K receivable on sole trader. Buyer path runs THROUGH ALIVE Live Well row.',
 '{"phase4": {"method": "known-active", "evidence": "Notion + Gmail phase-1 harvest (verified)"}}'::jsonb),

('supporter','PICC (Palm Island Community Company)','in_conversation','2026-05-15',
 'Confirm the ~$30K in-kind + video collaboration scope; PICC $113.3K receivable rides the sole-trader cutover (Rule 1)',
 '2026-06-30',
 E'--- Phase 4 frontier (2026-06-11) --- Palm Island anchor partner: video work + ~$30K in-kind support (phase-1 §Unmatched; Notion "Narelle annual-report" 26 Apr possibly PICC — unconfirmed). $113.3K active receivable on Nic''s sole trader. Palm Island = TFFF ask framing + JVT conference filming site; PICC is the on-ground partner for both. last_touch approximate (May activity, exact date unread).',
 '{"phase4": {"method": "known-active", "evidence": "phase-1 §Unmatched (reported); receivable verified in ledger"}}'::jsonb),

('advocate','Taboo / Eloise Hall','in_conversation','2026-06-10',
 'Support Eloise''s QLD Office of Social Impact coaching workstream (~$600K+ ask framing) — she is also driving the Butterfly handover (26 Jun)',
 '2026-06-26',
 E'--- Phase 4 frontier (2026-06-11) --- Eloise Hall (Taboo co-founder) is load-bearing: driving Kristy + Audrey''s Butterfly director appointments (10 Jun thread, verified), on the REAL submission cc, AND running QLD Office of Social Impact coaching with ~$600K+ ask framing for Goods. The deepest non-founder advocate in the system.',
 '{"phase4": {"method": "known-active", "evidence": "Gmail phase-1 harvest (verified)"}}'::jsonb),

('buyer','GW Space','contacted','2025-09-15',
 'Re-open with faith/tracey/kasee (gwspace.com.au) off the Aug-Sep 2025 Gapuwiyak delivery + demo-day; coordinate with the EARC revival (same Gapuwiyak substrate)',
 '2026-06-30',
 E'--- Phase 4 frontier (2026-06-11) --- Delivered beds Gapuwiyak Aug-Sep 2025 + demo-day talk (threads: "A Curious Tractor - Gapuwiyak NT"). Together with East Arnhem Regional Council, GW Space is the REAL substrate behind the GHL "$70.7K NLC Gapuwiyak" signal (phase-1 correction #7). last_touch approximate (Sep 2025 thread, exact date unread).',
 '{"phase4": {"method": "known-active", "evidence": "Gmail phase-1 harvest (verified); last_touch approximate"}}'::jsonb);

-- ===== C. Cold prospects (curated — capacity from foundations table) =====

INSERT INTO goods_relationships (relationship_type, display_name, stage, next_action, next_action_due, warm_intro_path, ask_purpose, notes, source_refs) VALUES
('funder','Indigenous Capital Limited','identified',
 'Research ICL''s instrument mix (grants vs investment) — indigenous + employment + social-enterprise focus is the closest cold match in the estate',
 '2026-07-31', NULL,
 'No ask yet. ~$1.9M/yr giving (foundations table). Indigenous + employment + social-enterprise — could be funder OR impact-investor for the production-site unit ($125K).',
 E'--- Phase 4 frontier (2026-06-11) --- Cold, thematically strongest: indigenous; employment; social-enterprise; arts. DGR route via Butterfly if grant; direct if investment.',
 '{"phase4": {"method": "cold-thematic", "verified": "foundations.total_giving_annual"}}'::jsonb),

('funder','Suncorp Foundation','identified',
 'Watch for open rounds — QLD corporate foundation (~$9M/yr); QBE-cohort credibility is the natural opener if a round fits',
 '2026-08-31', NULL,
 'No ask yet. ~$9M/yr giving (foundations table), QLD/NSW/national. Corporate-foundation playbook mirrors QBE: structured rounds, partnership framing.',
 E'--- Phase 4 frontier (2026-06-11) --- Cold corporate prospect. The QBE Foundation cohort story (insurer funding community resilience) is directly transferable.',
 '{"phase4": {"method": "cold-thematic", "verified": "foundations.total_giving_annual"}}'::jsonb);

-- ===== D. Updates to existing frontier-adjacent rows =====

UPDATE goods_relationships SET
  next_action='Work the Kim Harland (Philanthropy Aus QLD/NT) intro from Fiona (JVT) ahead of the 8-10 Sep conference — ACT is one of six featured videos',
  next_action_due='2026-08-15',
  notes = coalesce(nullif(notes,''),'') || E'\n--- Phase 4 frontier (2026-06-11) --- Conference 8-10 Sep is the activation moment: JVT-funded video (Red Movies, Palm Island filming), travel covered by JVT. Kim Harland intro available via Fiona.'
WHERE display_name='Philanthropy Australia';

UPDATE goods_relationships SET
  next_action='Cold but high-capacity (~$31M/yr, national, Indigenous themes): hold until one warm path appears — do NOT cold-email during the match campaign',
  next_action_due='2026-09-30',
  notes = coalesce(nullif(notes,''),'') || E'\n--- Phase 4 frontier (2026-06-11) --- Kept identified; capacity huge but no path. Revisit post-31 Aug with QBE match story as proof.'
WHERE display_name='Kinghorn Foundation';

COMMIT;

-- Verify
SELECT stage, COUNT(*) FROM goods_relationships GROUP BY stage ORDER BY 2 DESC;
SELECT display_name, relationship_type, stage FROM goods_relationships WHERE source_refs ? 'phase4' ORDER BY display_name;

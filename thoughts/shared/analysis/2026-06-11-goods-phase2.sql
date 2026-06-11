-- Goods Relationship Engine — Phase 2 (position): restages + next actions
-- 2026-06-11. Evidence: thoughts/shared/analysis/2026-06-11-goods-phase1-report.md
BEGIN;

-- ========== A. RESTAGES (evidence-backed, report §Feeds Phase 2) ==========

UPDATE goods_relationships SET stage='dormant',
  notes = notes || E'\n--- Phase 2 (2026-06-11) --- restaged proposal→dormant: paused BY Minderoo 14 May (Lucy Stronach, all justice conversations); no live proposal exists.',
  next_action='Optional non-ask Contained-in-Perth touchpoint to Lucy Stronach ~July', next_action_due='2026-07-15'
WHERE display_name='Minderoo Foundation';

UPDATE goods_relationships SET stage='dormant',
  notes = notes || E'\n--- Phase 2 (2026-06-11) --- restaged repeat→dormant: IGNITE EOI declined Feb 2026; alumni-only, no live ask either direction.',
  next_action='Keep alumni channel warm; watch BFGN for next AMP round', next_action_due='2026-08-31'
WHERE display_name='AMP Foundation';

UPDATE goods_relationships SET stage='contacted',
  notes = notes || E'\n--- Phase 2 (2026-06-11) --- restaged proposal→contacted: no capital conversation exists in email; only Feb 2026 Cape York referral exchange with Chelsea Baker. $300K LOI claim had no substrate.',
  next_action='Open the debt/blended-capital thread with Chelsea Baker (engagement-review action #5)', next_action_due='2026-06-20'
WHERE display_name='Social Enterprise Finance Australia (SEFA)';

UPDATE goods_relationships SET stage='dormant',
  notes = notes || E'\n--- Phase 2 (2026-06-11) --- restaged repeat→dormant: program partner not funder; no email contact 8+ months (last 2025-10-01).',
  next_action='Re-open for 2026 program dates + request captured Kintore/Pintupi stories for proof pack', next_action_due='2026-07-31'
WHERE display_name='Red Dust';

UPDATE goods_relationships SET stage='dormant',
  notes = notes || E'\n--- Phase 2 (2026-06-11) --- restaged repeat→dormant: one unanswered outbound 2025-09-18; relationship lives off-email (Maningrida origin), channel cold 9 months.',
  next_action='Fresh re-engagement via Snow BHAC/Maningrida laundry angle, or log the real channel', next_action_due='2026-07-31'
WHERE display_name='Mala''la Health Service Aboriginal Corp';

UPDATE goods_relationships SET stage='dormant',
  notes = notes || E'\n--- Phase 2 (2026-06-11) --- restaged repeat→dormant: healthy alumni standing, no live ask either direction; 12-month impact update due ~Sep 2026.',
  next_action='Diarise Sep 12-month impact update; consider TFN for a future Goods pitch event', next_action_due='2026-09-01'
WHERE display_name='The Funding Network';

UPDATE goods_relationships SET stage='researching',
  notes = notes || E'\n--- Phase 2 (2026-06-11) --- restaged in_conversation→researching: zero written substrate under any name variant; possible duplicate of Centrecorp (legal name "Centrecorp Aboriginal Investment Corporation"). Founder confirm before treating as live.',
  next_action='FOUNDER CONFIRM: distinct entity + contact person (vs Centrecorp duplicate); log channel or start a thread', next_action_due='2026-06-18'
WHERE display_name='Aboriginal Investment NT';

UPDATE goods_relationships SET relationship_type='supporter',
  notes = notes || E'\n--- Phase 2 (2026-06-11) --- type buyer→supporter: research partner (MRF2051566), $60K buyer record was a GHL mislabel (zeroed). NEW potential buyer thread: Live Well govt tender, 6 residential rehabs, Goods/SMART drink bottle (9 Jun).',
  next_action='Confirm/decline Witta visit date with Vicki Palmer; open the Live Well drink-bottle thread', next_action_due='2026-06-18'
WHERE display_name='ALIVE';

UPDATE goods_relationships SET stage='contacted',
  notes = coalesce(nullif(notes,''),'') || E'\n--- Phase 2 (2026-06-11) --- restaged identified→contacted: real written substrate — Sharon Wunungmurra inbound Oct 2025 (Gapuwiyak aged-care/community beds) + GW Space bed delivery Aug-Sep 2025. The GHL $70.7K Gapuwiyak opportunity may wrongly name NLC.',
  next_action='Revive Gapuwiyak thread via Sharon Wunungmurra / Amy Elson; fix GHL opp org attribution (NLC→EARC?)', next_action_due='2026-06-30'
WHERE display_name='East Arnhem Regional Council' AND stage='identified';

UPDATE goods_relationships SET
  notes = coalesce(nullif(notes,''),'') || E'\n--- Phase 2 (2026-06-11) --- caution: Gapuwiyak email substrate is East Arnhem Regional Council + GW Space, NOT NLC. Founder confirm before relying on this row.',
  next_action='FOUNDER CONFIRM: is NLC actually in this conversation, or is it EARC/GW Space?', next_action_due='2026-06-30'
WHERE display_name='Northern Land Council — GAPUWIYAK';

-- ========== B. NEXT ACTIONS for remaining live rows ==========

UPDATE goods_relationships SET next_action='Lock the delivery call with Nic Sharah THIS WEEK; delivery must land in the 10-17 Jul NT window; invoice gated on their grant deposit', next_action_due='2026-06-13'
WHERE display_name='Homeland School Company';

UPDATE goods_relationships SET next_action='Paper the verbal investment commitment (LOI for QBE match, due 31 Aug); Butterfly director paperwork lands 26 Jun; REAL outcome ~end Jun', next_action_due='2026-06-26'
WHERE display_name='Oonchiumpa Bloomfield Family Trust';

UPDATE goods_relationships SET next_action='FOUNDER CONFIRM: where does the AHL proposal actually live (Nic mailbox/portal)? Mirror into shared records before any tender/MMR claim', next_action_due='2026-06-18'
WHERE display_name='Aboriginal Hostels Limited (AHL)';

UPDATE goods_relationships SET next_action='Chase Sandy Shaw on the 28 May Contained pitch; put a direct, specific proposal to Sarah Bartak/Anita', next_action_due='2026-06-20'
WHERE display_name='Brian M Davis Charitable Foundation';

UPDATE goods_relationships SET next_action='EMAIL Randle: confirm 130-bed V.2 proposal is on the 26 Jun board agenda + ask what the board pack needs (create written substrate)', next_action_due='2026-06-16'
WHERE display_name='Centrecorp Foundation - 130 Stretch Beds - June 26 board';

UPDATE goods_relationships SET next_action='Diarise REAL Stage 2 outcome check-in (expected ~end June; kick-off mid-Jul)', next_action_due='2026-06-30'
WHERE display_name='DEWR (Federal)';

UPDATE goods_relationships SET next_action='Re-engage Will Frazer/Jonas with REAL Stage 2 shortlist + Snow win as momentum proof — NO dollar ask (patient FY27 track)', next_action_due='2026-06-30'
WHERE display_name='Paul Ramsay Foundation';

UPDATE goods_relationships SET next_action='SEND cost-model package to Matt Allen BEFORE 18 Jun check-in (overdue since 1 Jun); reply to the Phil Vernon mentor intro', next_action_due='2026-06-16'
WHERE display_name='QBE Foundation';

UPDATE goods_relationships SET next_action='Outcome check-in end June (shortlisted, ~$2M/3yr, Oonchiumpa lead); prep for mid-Jul kick-off if won', next_action_due='2026-06-30'
WHERE display_name='REAL Innovation Fund (DEWR)';

UPDATE goods_relationships SET next_action='Chase Pene Curtis for Global Grant status + offer help finding club partners (silent since 13 Apr)', next_action_due='2026-06-18'
WHERE display_name='Rotary Eclub Outback Australia';

UPDATE goods_relationships SET next_action='Status chase with Pene Curtis (see Rotary Eclub row — same thread)', next_action_due='2026-06-18'
WHERE display_name='Rotary Global Grant (washers/beds)';

UPDATE goods_relationships SET next_action='Build 6-7 Jul visit agenda WITH the $150K/2yr youth-pathways matched-capital ask; confirm Matthew Cox accepted the calendar invite', next_action_due='2026-06-27'
WHERE display_name='The Bryan Foundation';

UPDATE goods_relationships SET next_action='⚡ SUBMIT EOI by 18 JUN: 3-4 pages + basic budget, $100-150K/yr × 3yrs, employment-outcomes focus (Alberto Furlan invitation 3 Jun)', next_action_due='2026-06-18'
WHERE display_name='The Ian Potter Foundation';

UPDATE goods_relationships SET next_action='Send Katie Norman 2-3 concrete June meeting dates ($100K site/Palm Is ask at meeting); reply to Richard Brooking with a Witta window', next_action_due='2026-06-12'
WHERE display_name='Tim Fairfax Family Foundation';

UPDATE goods_relationships SET next_action='FOUNDER CONFIRM latest phone status with Randle; move the channel to email for substrate (board 26 Jun)', next_action_due='2026-06-16'
WHERE display_name='Centrecorp Foundation' AND stage='repeat';

UPDATE goods_relationships SET next_action='Await FRRR climate-round eligibility decision (entity question answered 2 Jun); nudge Danielle if silent by end June', next_action_due='2026-06-30'
WHERE display_name='FRRR';

UPDATE goods_relationships SET next_action='Ben: create Julalikari washer-RFQ opportunity in GHL Buyer Pipeline; gentle follow-up on the 7 Jun quotes if silent', next_action_due='2026-06-16'
WHERE display_name='Julalikari Council Aboriginal Corp';

UPDATE goods_relationships SET next_action='Decide + prep CBF NT application (round opens 1 Jul, closes 31 Aug; Our Community Shed offered to host/auspice); catch Michelle late June', next_action_due='2026-06-30'
WHERE display_name='Our Community Shed';

UPDATE goods_relationships SET next_action='Revive Cat (cvecchio@qic.com) with delivery proof + a concrete 2026 NAIDOC/procurement proposal (silent 4 months)', next_action_due='2026-06-30'
WHERE display_name='QIC';

UPDATE goods_relationships SET next_action='LOI-conversion ask to Sally/Georgie for the QBE match (Sep ~$200K return mooted); send airport-display wrap-up thanks', next_action_due='2026-06-18'
WHERE display_name='Snow Foundation';

UPDATE goods_relationships SET next_action='Send Fiona filming/Palm update + Philanthropy Aus conference logistics (travel costs offer accepted — capture in money tracker)', next_action_due='2026-06-20'
WHERE display_name='The John Villiers Trust';

UPDATE goods_relationships SET next_action='Decide whether to open a direct thread with El Schwanke using the clean Palm Island acquittal + Steph Pearson praise as hook', next_action_due='2026-06-30'
WHERE display_name='Vincent Fairfax Family Foundation';

UPDATE goods_relationships SET next_action='Chase Tony Miles on the 9 Feb washer quote (4 units, Tennant Creek — unanswered 4 months)', next_action_due='2026-06-18'
WHERE display_name='Anyinginyi Health Aboriginal Corporation';

UPDATE goods_relationships SET next_action='FOUNDER CONFIRM contact person + channel; send first email to create written substrate', next_action_due='2026-06-20'
WHERE display_name='Centrebuild Pty Ltd';

UPDATE goods_relationships SET next_action='Log phone as the real channel or anchor the relationship in writing (chickens-by-helicopter warmth is real, substrate is not)', next_action_due='2026-06-20'
WHERE display_name='Hewitt Agriculture';

UPDATE goods_relationships SET next_action='Ask Amy Elson to land the Regina intro; Miwatj reply owed since 11 Mar nudge', next_action_due='2026-06-20'
WHERE display_name='Miwatj Health Aboriginal Corporation';

UPDATE goods_relationships SET next_action='Open a FIRST bilateral thread (Georgie Byron = warm bridge via RHD events) — required before NACCHO support is claimable in QBE letters', next_action_due='2026-07-31'
WHERE display_name='NACCHO';

-- ========== C. Recompute warmth from corrected stage + last_touch ==========
UPDATE goods_relationships
SET warmth_computed = goods_compute_warmth(stage, last_touch_at, total_received_aud, alignment_score, has_prior_support, advocacy_score),
    updated_at = now()
WHERE stage IN ('in_conversation','proposal','committed','repeat','dormant','contacted','researching');

COMMIT;

-- Verify
SELECT stage, COUNT(*) FROM goods_relationships GROUP BY stage ORDER BY 2 DESC;
SELECT COUNT(*) AS live_with_actions FROM goods_relationships WHERE stage IN ('in_conversation','proposal','committed','repeat','dormant','contacted') AND next_action IS NOT NULL AND next_action_due IS NOT NULL;

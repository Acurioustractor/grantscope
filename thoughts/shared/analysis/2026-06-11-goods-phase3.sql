-- Goods Relationship Engine — Phase 3 (asks): ask_amount_aud / ask_purpose / framing.ask_framing
-- 2026-06-11. Method + numbers: thoughts/shared/briefs/2026-06-10-goods-ask-sizing.md (ACNC-verified capacity).
-- Amounts pending Ben's final sign-off are marked "per brief" in ask_purpose. No invented numbers:
-- rows without an evidence-backed figure get ask_purpose only.
BEGIN;

-- ===== Match-campaign funders (brief-sized) =====

UPDATE goods_relationships SET ask_amount_aud=100000,
  ask_purpose='$100K per ask-sizing brief (≈1.4% of TFFF $7.34M FY23 giving): one community production site co-funded OR named QLD deployment (Palm Island/Mount Isa). Ask AT the June meeting; LOI by 31 Aug for QBE match.',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','community production site ($125K) / named bed run','match_multiplier',true,
    'vehicle','Butterfly Movement Ltd (Item 1 DGR+PBI)','source','2026-06-10 ask-sizing brief','status','pending Ben sign-off'))
WHERE display_name='Tim Fairfax Family Foundation';

UPDATE goods_relationships SET ask_amount_aud=150000,
  ask_purpose='$150K over 2yrs ($75K/yr ≈3% of Bryan $2.29M FY23 giving) per ask-sizing brief: community manufacturing as young-people pathways (Matthew Cox lens = youth/education; tie to Oonchiumpa REAL justice-exit work). The 6-7 Jul site visit IS the ask moment; LOI by Aug.',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','one community production site, youth-pathways framing','match_multiplier',true,
    'vehicle','Butterfly Movement Ltd (Item 1 DGR+PBI)','source','2026-06-10 ask-sizing brief','status','pending Ben sign-off'))
WHERE display_name='The Bryan Foundation';

UPDATE goods_relationships SET ask_amount_aud=375000,
  ask_purpose='EOI invited by Alberto Furlan (3 Jun, due 18 JUN): $100-150K/yr x 3yrs, employment-outcomes focus — logged at midpoint $375K total. SUPERSEDES brief''s $50-100K menu. Capacity not the constraint ($46.2M FY23 giving); fit is. Amount range from Notion transcript — reported, confirm with Alberto.',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','multi-year employment outcomes (3-4pp EOI + basic budget)','match_multiplier',true,
    'vehicle','Butterfly Movement Ltd (Item 1 DGR+PBI)','source','Alberto Furlan EOI invitation 2026-06-03 (Notion transcript, reported)','status','EOI due 2026-06-18'))
WHERE display_name='The Ian Potter Foundation';

UPDATE goods_relationships SET ask_amount_aud=50000,
  ask_purpose='$25-50K per ask-sizing brief (logged at top of range; ≈0.7% of BMD $5.65M FY23 giving): something whole and finishable — washing-machine pilot or one community''s 30-bed run. 1-page proposal direct to Sarah Bartak + Anita this week (not via Sandy).',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','completable pilot (washers / 30-bed run)','match_multiplier',true,
    'vehicle','Butterfly Movement Ltd (Item 1 DGR+PBI)','source','2026-06-10 ask-sizing brief','status','pending Ben sign-off'))
WHERE display_name='Brian M Davis Charitable Foundation';

UPDATE goods_relationships SET ask_amount_aud=NULL,
  ask_purpose='NO dollar ask (brief decision, Ben-agreed): PRF operates $1M+ multi-year — $100K undersells, $1M premature at 7-months-cold. Patient FY27 partnership track; re-engage with momentum proof (Snow win, REAL shortlist, QBE cohort). OUT of the 31-Aug match campaign.',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','none — FY27 scoping conversation first','match_multiplier',false,
    'source','2026-06-10 ask-sizing brief','status','patient track'))
WHERE display_name='Paul Ramsay Foundation';

-- Centrecorp: move the 130-bed ask to its own (proposal) row; de-dupe the repeat row
UPDATE goods_relationships SET ask_amount_aud=106150,
  ask_purpose='130 Stretch Beds V.2 — $106,150 (GHL, verified) at the 26 Jun Centrecorp board. Board won''t fund V.1 again nor retro-fund the 200 delivered. Counts toward QBE match if papered as LOI. Confirm agenda + board-pack needs with Randle BY EMAIL.',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','130 Stretch Beds (V.2)','match_multiplier',true,
    'vehicle','direct (Centrecorp donation history)','source','GHL opportunity + Feb 2026 thread','status','board 2026-06-26'))
WHERE display_name='Centrecorp Foundation - 130 Stretch Beds - June 26 board';

UPDATE goods_relationships SET ask_amount_aud=NULL,
  ask_purpose='Live ask tracked on the dedicated "130 Stretch Beds - June 26 board" row ($106,150) — de-duped 2026-06-11 to avoid double-counting. This row = the standing donor relationship (first donation Aug 2025).'
WHERE display_name='Centrecorp Foundation' AND stage='repeat';

UPDATE goods_relationships SET ask_amount_aud=400000,
  ask_purpose='QBE Stage 2 grant (application due Sept): $150-400K, logged at top of band — gated on >=$400K legally-binding matched co-funding (3+ signed LOIs) by 31 Aug. THE campaign anchor. Gate: cost model to Matt Allen + LOI wording from Jay 18 Jun.',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','Stage 2 grant, match-gated','match_multiplier',false,
    'source','QBE cohort arc (verified Gmail)','status','Stage 2 due Sept; match due 31 Aug'))
WHERE display_name='QBE Foundation';

UPDATE goods_relationships SET ask_amount_aud=200000,
  ask_purpose='LOI-conversion of Snow''s rolling support toward QBE match + the mooted ~$200K September return (Mar intel — ESTIMATE, not committed; "no more available this FY" per 19 May grant letter). $120K FY26 grant already WON. Ask Sally/Georgie for match-creditable wording.',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','LOI conversion + Sep return','match_multiplier',true,
    'source','phase-1 harvest (Mar intel = reported)','status','amount is mooted, not committed'))
WHERE display_name='Snow Foundation';

-- ===== Government / grant rows =====

UPDATE goods_relationships SET ask_amount_aud=2000000,
  ask_purpose='REAL Stage 2: ~$2M/3yr, SHORTLISTED, outcome ~end Jun. Oonchiumpa lead (60-80% of funds), ACT partner — headline figure is NOT ACT''s share. 60 young people/yr exiting justice system.',
  framing = coalesce(framing,'{}'::jsonb) || jsonb_build_object('ask_framing', jsonb_build_object(
    'unit','3yr employment program','match_multiplier',false,
    'source','Stage 2 submission 2026-06-02 (verified Gmail)','status','shortlisted, outcome ~end Jun'))
WHERE display_name='REAL Innovation Fund (DEWR)';

UPDATE goods_relationships SET
  ask_purpose='Live ask tracked on the REAL Innovation Fund row (~$2M/3yr Stage 2, shortlisted). No other DEWR thread.'
WHERE display_name='DEWR (Federal)';

UPDATE goods_relationships SET
  ask_purpose='Rotary Global Grant (washers/beds, Anyinginyi community partner): submitted ~13 Mar, docs in system, club partner-funding gaps being worked — grant value not stated in email; get the figure from Pene.'
WHERE display_name='Rotary Global Grant (washers/beds)';

UPDATE goods_relationships SET
  ask_purpose='FRRR Community Led Climate Solutions (Palm Island) — awaiting eligibility decision (entity question answered 2 Jun). Round value not in email. Separate: warm VFFF bridge via Steph Pearson.'
WHERE display_name='FRRR';

UPDATE goods_relationships SET
  ask_purpose='CBF NT round via Our Community Shed auspice/host (opens 1 Jul, closes 31 Aug — overlaps QBE match window). Round/ask value TBD when guidelines land; decide before 1 Jul.'
WHERE display_name='Our Community Shed';

-- ===== Committed / delivery rows =====

UPDATE goods_relationships SET
  ask_purpose='2 washers + 40 beds test (proposed 5 May; invoice sent ~25 May — value not in email, pull from Xero). Payment gated on Homeland''s grant deposit (AGM mid-Jul); delivery in Nic''s 10-17 Jul NT window.'
WHERE display_name='Homeland School Company';

UPDATE goods_relationships SET
  ask_purpose='Paper the verbal equity/investment commitment (26% stake in 51% First Nations structure) as a QBE-match LOI by 31 Aug — no dollar figure exists in writing; founder to put the number to it.'
WHERE display_name='Oonchiumpa Bloomfield Family Trust';

-- ===== Other live rows (purpose only — no evidence-backed amount) =====

UPDATE goods_relationships SET
  ask_purpose='Target per engagement review: ~$300K concessional working-capital loan — but NO capital thread exists yet (phase-1 verdict); amount stays unlogged until Chelsea conversation opens. Doesn''t count toward QBE match (debt).'
WHERE display_name='Social Enterprise Finance Australia (SEFA)';

UPDATE goods_relationships SET
  ask_purpose='Revive with delivery proof + concrete 2026 NAIDOC/procurement proposal — prior NAIDOC bed project funded 2025; no new number until the proposal is shaped.'
WHERE display_name='QIC';

UPDATE goods_relationships SET
  ask_purpose='Travel-cost coverage for Philanthropy Australia conference filming OFFERED + ACCEPTED (29 Apr/5 May — capture in money tracker); JVT explicitly cannot fund the Palm beds project itself.'
WHERE display_name='The John Villiers Trust';

UPDATE goods_relationships SET
  ask_purpose='No live ask — alumni of Backing the Future (via FRRR). If direct thread opens (El Schwanke), hook = clean Palm Island acquittal + Steph Pearson praise.'
WHERE display_name='Vincent Fairfax Family Foundation';

UPDATE goods_relationships SET
  ask_purpose='Inbound washer RFQ (Delaicee Power): two quotes sent 7 Jun (washers + washable-beds upsell) — quote values in Nic''s quotes, mirror into GHL opportunity.'
WHERE display_name='Julalikari Council Aboriginal Corp';

UPDATE goods_relationships SET
  ask_purpose='9 Feb quote: 4 Goods v1 washers delivered Tennant Creek (value not in email) — unanswered 4 months; Tony''s remit = Piliyintinji-ki program only. Also community partner on Rotary Global Grant.'
WHERE display_name='Anyinginyi Health Aboriginal Corporation';

UPDATE goods_relationships SET
  ask_purpose='Pricing shared Nov 2025 ($350 basket-bed kits, ~$600 Jape/Stretch); no order yet — reply owed since 11 Mar. Amy Elson''s Regina intro is the live thread.'
WHERE display_name='Miwatj Health Aboriginal Corporation';

UPDATE goods_relationships SET
  ask_purpose='Tennant Creek pilot (20 Stretch Beds) + standing-offer panel target — proposal location unverified (no written substrate; founder confirm where it lives).'
WHERE display_name='Aboriginal Hostels Limited (AHL)';

UPDATE goods_relationships SET
  ask_purpose='Peak-body endorsement + 3-ACCHO pilot (secondary-buyer) — NOT money; unclaimable for QBE letters until a first bilateral thread exists (Georgie Byron bridge).'
WHERE display_name='NACCHO';

UPDATE goods_relationships SET
  ask_purpose='Possible NEW buyer thread: Goods/SMART drink bottle into Live Well''s 6 govt-tendered residential rehabs (9 Jun signal — early, funds available, no number yet). Research partnership (MRF2051566) is the standing relationship.'
WHERE display_name='ALIVE';

COMMIT;

-- Verify
SELECT COUNT(*) FILTER (WHERE ask_amount_aud IS NOT NULL) AS with_amount,
       COUNT(*) FILTER (WHERE ask_purpose IS NOT NULL) AS with_purpose
FROM goods_relationships WHERE stage IN ('in_conversation','proposal','committed','repeat','contacted','dormant');
SELECT display_name, ask_amount_aud FROM goods_relationships WHERE ask_amount_aud IS NOT NULL ORDER BY ask_amount_aud DESC;

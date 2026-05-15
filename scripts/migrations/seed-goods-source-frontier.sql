-- Seed goods-shaped sources into source_frontier
-- These cover three lanes:
--   1. Federal Indigenous funding bodies that grant + procure (NIAA, ILC, IBA, ABA)
--   2. State housing/community-infra depts (NT, WA, NSW Aboriginal Affairs, QLD First Nations)
--   3. NT remote council tender portals — the actual buyer surfaces for the 8+ active Goods communities
--   4. Procurement-side portals (Indigenous Business Direct, NDIA market stewardship)
--
-- Each row maps target_url → parser_hint. Parsers live in scripts/poll-source-frontier.mjs +
-- per-hint extractors. New hints log raw HTML; we add extractors as patterns surface.
--
-- Idempotent on source_key (UNIQUE constraint).

BEGIN;

INSERT INTO source_frontier (
  source_key, source_kind, source_name, target_url, domain, parser_hint,
  cadence_hours, priority, enabled, confidence, metadata
) VALUES

-- ────────────────────────────────────────────────────────────────────────────
-- LANE 1: Federal Indigenous funding bodies
-- ────────────────────────────────────────────────────────────────────────────
('grant-source:niaa:aba', 'grant_source_page',
 'NIAA Aboriginals Benefit Account (ABA) Grants',
 'https://www.niaa.gov.au/our-work/grants-and-funding/aboriginals-benefit-account',
 'niaa.gov.au', 'niaa-aba-monitor',
 48, 8, true, 'high',
 '{"goods_focus": true, "lane": "indigenous-grants", "notes": "ABA funds NT Aboriginal community infrastructure — beds/housing fit cleanly"}'::jsonb),

('grant-source:niaa:ipp', 'grant_source_page',
 'NIAA Indigenous Procurement Policy',
 'https://www.niaa.gov.au/our-work/economic-development/indigenous-procurement-policy',
 'niaa.gov.au', 'niaa-ipp-monitor',
 168, 6, true, 'high',
 '{"goods_focus": true, "lane": "procurement-policy", "notes": "Mandatory minimum Indigenous procurement targets — find buyers obligated to source from Goods"}'::jsonb),

('grant-source:ilc:funding', 'grant_source_page',
 'Indigenous Land and Sea Corporation Funding',
 'https://www.ilsc.gov.au/applicants/',
 'ilsc.gov.au', 'ilsc-funding-monitor',
 72, 8, true, 'high',
 '{"goods_focus": true, "lane": "indigenous-grants", "notes": "ILSC funds community infrastructure on Aboriginal-owned land"}'::jsonb),

('grant-source:iba:programs', 'grant_source_page',
 'Indigenous Business Australia Programs',
 'https://iba.gov.au/business/',
 'iba.gov.au', 'iba-programs-monitor',
 168, 6, true, 'medium',
 '{"goods_focus": true, "lane": "indigenous-grants", "notes": "Business finance for Indigenous-controlled supply chains"}'::jsonb),

('grant-source:fac:programs', 'grant_source_page',
 'First Australians Capital',
 'https://firstaustralianscapital.org/',
 'firstaustralianscapital.org', 'foundation-program-monitor',
 168, 7, true, 'medium',
 '{"goods_focus": true, "lane": "indigenous-capital"}'::jsonb),

-- ────────────────────────────────────────────────────────────────────────────
-- LANE 2: State housing / community-infra departments
-- ────────────────────────────────────────────────────────────────────────────
('grant-source:nt-dlghcd:grants', 'grant_source_page',
 'NT Local Government, Housing & Community Development Grants',
 'https://nt.gov.au/community/community-organisations/grants-and-funding',
 'nt.gov.au', 'nt-community-grants-monitor',
 48, 8, true, 'high',
 '{"goods_focus": true, "lane": "state-housing", "geography": "AU-NT"}'::jsonb),

('grant-source:nt-dchde:housing', 'grant_source_page',
 'NT Housing Aboriginal Community Programs',
 'https://nt.gov.au/property/community-housing',
 'nt.gov.au', 'nt-housing-monitor',
 72, 7, true, 'medium',
 '{"goods_focus": true, "lane": "state-housing", "geography": "AU-NT"}'::jsonb),

('grant-source:wa-dch:aboriginal', 'grant_source_page',
 'WA Department of Communities — Aboriginal Housing',
 'https://www.wa.gov.au/organisation/department-of-communities/aboriginal-housing',
 'wa.gov.au', 'wa-aboriginal-housing-monitor',
 72, 7, true, 'medium',
 '{"goods_focus": true, "lane": "state-housing", "geography": "AU-WA"}'::jsonb),

('grant-source:nsw-aac:closing-the-gap', 'grant_source_page',
 'NSW Aboriginal Affairs — Closing the Gap',
 'https://www.aboriginalaffairs.nsw.gov.au/our-business/closing-the-gap/',
 'aboriginalaffairs.nsw.gov.au', 'nsw-aac-monitor',
 48, 7, true, 'high',
 '{"goods_focus": true, "lane": "state-indigenous", "geography": "AU-NSW"}'::jsonb),

('grant-source:qld-dseo:first-nations', 'grant_source_page',
 'QLD First Nations Partnerships Grants',
 'https://www.dtatsipca.qld.gov.au/our-work/grant-programs',
 'qld.gov.au', 'qld-first-nations-monitor',
 48, 7, true, 'high',
 '{"goods_focus": true, "lane": "state-indigenous", "geography": "AU-QLD"}'::jsonb),

('grant-source:sa-aar:grants', 'grant_source_page',
 'SA Aboriginal Affairs and Reconciliation Grants',
 'https://www.dpc.sa.gov.au/responsibilities/aboriginal-affairs-and-reconciliation/programs',
 'sa.gov.au', 'sa-aar-monitor',
 72, 6, true, 'medium',
 '{"goods_focus": true, "lane": "state-indigenous", "geography": "AU-SA"}'::jsonb),

-- ────────────────────────────────────────────────────────────────────────────
-- LANE 3: NT Remote Council tender portals — actual buyer surfaces
-- ────────────────────────────────────────────────────────────────────────────
('procurement-source:barkly:tenders', 'grant_source_page',
 'Barkly Regional Council Tenders',
 'https://www.barkly.nt.gov.au/council/tenders-quotes-and-expressions-of-interest',
 'barkly.nt.gov.au', 'council-tender-monitor',
 48, 8, true, 'high',
 '{"goods_focus": true, "lane": "procurement", "scope": "RFQ/RFT for beds, white-goods, community equipment", "communities": ["Tennant Creek","Ali Curung","Alpurrurulam","Ampilatwatja","Canteen Creek"]}'::jsonb),

('procurement-source:macdonnell:tenders', 'grant_source_page',
 'MacDonnell Regional Council Tenders',
 'https://www.macdonnell.nt.gov.au/council/tenders',
 'macdonnell.nt.gov.au', 'council-tender-monitor',
 48, 8, true, 'high',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Hermannsburg","Atitjere","Areyonga","Engawala","Kintore","Mt Liebig","Imanpa","Kaltukatjara","Laramba","Papunya","Santa Teresa"]}'::jsonb),

('procurement-source:central-desert:tenders', 'grant_source_page',
 'Central Desert Regional Council Tenders',
 'https://www.centraldesert.nt.gov.au/council/tenders',
 'centraldesert.nt.gov.au', 'council-tender-monitor',
 48, 7, true, 'medium',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Yuendumu","Nyirripi","Willowra","Lajamanu","Anmatjere"]}'::jsonb),

('procurement-source:roper-gulf:tenders', 'grant_source_page',
 'Roper Gulf Regional Council Tenders',
 'https://www.ropergulf.nt.gov.au/council/tenders-and-public-notices',
 'ropergulf.nt.gov.au', 'council-tender-monitor',
 48, 7, true, 'medium',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Barunga","Beswick","Binjari","Bulman","Jilkminggan"]}'::jsonb),

('procurement-source:west-arnhem:tenders', 'grant_source_page',
 'West Arnhem Regional Council Tenders',
 'https://www.westarnhem.nt.gov.au/council/tenders',
 'westarnhem.nt.gov.au', 'council-tender-monitor',
 48, 8, true, 'high',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Maningrida","Minjilang","Warruwi","Gunbalanya"]}'::jsonb),

('procurement-source:tiwi:tenders', 'grant_source_page',
 'Tiwi Islands Regional Council Tenders',
 'https://www.tiwiislands.nt.gov.au/business/tenders',
 'tiwiislands.nt.gov.au', 'council-tender-monitor',
 72, 6, true, 'medium',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Wurrumiyanga","Milikapiti","Pirlangimpi"]}'::jsonb),

('procurement-source:east-arnhem:tenders', 'grant_source_page',
 'East Arnhem Regional Council Tenders',
 'https://www.eastarnhem.nt.gov.au/council/tenders',
 'eastarnhem.nt.gov.au', 'council-tender-monitor',
 48, 7, true, 'medium',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Yirrkala","Gunyangara","Galiwinku","Ramingining"]}'::jsonb),

('procurement-source:victoria-daly:tenders', 'grant_source_page',
 'Victoria Daly Regional Council Tenders',
 'https://www.victoriadaly.nt.gov.au/council/tenders',
 'victoriadaly.nt.gov.au', 'council-tender-monitor',
 72, 6, true, 'medium',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Belyuen","Daguragu","Kalkarindji"]}'::jsonb),

('procurement-source:palm-island:tenders', 'grant_source_page',
 'Palm Island Aboriginal Shire Council Tenders',
 'https://www.palmisland.qld.gov.au/council/tenders',
 'palmisland.qld.gov.au', 'council-tender-monitor',
 48, 9, true, 'high',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Palm Island"], "notes": "Priority — active Goods buyer relationship"}'::jsonb),

('procurement-source:kalgoorlie:tenders', 'grant_source_page',
 'City of Kalgoorlie-Boulder Tenders',
 'https://www.ckb.wa.gov.au/Business/Procurement/Tenders',
 'ckb.wa.gov.au', 'council-tender-monitor',
 48, 7, true, 'medium',
 '{"goods_focus": true, "lane": "procurement", "communities": ["Kalgoorlie"]}'::jsonb),

-- ────────────────────────────────────────────────────────────────────────────
-- LANE 4: Procurement panels & supplier directories
-- ────────────────────────────────────────────────────────────────────────────
('procurement-source:ibd:directory', 'grant_source_page',
 'Indigenous Business Direct (IBD)',
 'https://www.supplynation.org.au/indigenous-business-direct/',
 'supplynation.org.au', 'ibd-supplier-monitor',
 168, 6, true, 'high',
 '{"goods_focus": true, "lane": "procurement", "notes": "Verified Indigenous suppliers — Goods can register and find aligned buyers"}'::jsonb),

('procurement-source:nt-stores:licensing', 'grant_source_page',
 'NT Remote Community Stores Licensing',
 'https://stores.nt.gov.au/stores/store-list',
 'nt.gov.au', 'nt-stores-monitor',
 168, 6, true, 'medium',
 '{"goods_focus": true, "lane": "procurement", "notes": "Licensed remote stores — supply route partners for white-goods distribution"}'::jsonb),

('grant-source:ndia:market-stewardship', 'grant_source_page',
 'NDIA Market Stewardship Grants',
 'https://www.ndis.gov.au/about-us/strategies/our-priorities',
 'ndis.gov.au', 'ndia-monitor',
 168, 5, true, 'medium',
 '{"goods_focus": true, "lane": "ndis", "notes": "Disability housing assistive tech — bed/equipment fit"}'::jsonb),

-- ────────────────────────────────────────────────────────────────────────────
-- LANE 5: ACCO peaks (signposts to live grants + procurement asks)
-- ────────────────────────────────────────────────────────────────────────────
('grant-source:naccho:grants', 'grant_source_page',
 'NACCHO Member Funding Opportunities',
 'https://www.naccho.org.au/funding/',
 'naccho.org.au', 'acco-peak-monitor',
 168, 5, true, 'medium',
 '{"goods_focus": true, "lane": "acco-peak", "notes": "Aboriginal Community Controlled Health Organisations peak"}'::jsonb),

('grant-source:snaicc:opportunities', 'grant_source_page',
 'SNAICC Funding & Tenders',
 'https://www.snaicc.org.au/policy-and-research/',
 'snaicc.org.au', 'acco-peak-monitor',
 168, 5, true, 'medium',
 '{"goods_focus": true, "lane": "acco-peak", "notes": "National First Nations children\'s peak"}'::jsonb),

('grant-source:absec:opportunities', 'grant_source_page',
 'AbSec Tenders & Grants',
 'https://www.absec.org.au/',
 'absec.org.au', 'acco-peak-monitor',
 168, 5, true, 'medium',
 '{"goods_focus": true, "lane": "acco-peak", "geography": "AU-NSW", "notes": "NSW Aboriginal child & family peak"}'::jsonb),

-- ────────────────────────────────────────────────────────────────────────────
-- LANE 6: High-value Indigenous foundations not in foundations table yet
-- ────────────────────────────────────────────────────────────────────────────
('grant-source:kkt:programs', 'grant_source_page',
 'Karrkad Kanjdji Trust',
 'https://kkt.org.au/our-programs/',
 'kkt.org.au', 'foundation-program-monitor',
 168, 6, true, 'medium',
 '{"goods_focus": true, "lane": "indigenous-foundation", "geography": "AU-NT"}'::jsonb),

('grant-source:lowitja:grants', 'grant_source_page',
 'Lowitja Institute Funding',
 'https://www.lowitja.org.au/page/grants-funding',
 'lowitja.org.au', 'foundation-program-monitor',
 168, 5, true, 'medium',
 '{"goods_focus": true, "lane": "indigenous-foundation"}'::jsonb),

('grant-source:centrecorp:foundation', 'grant_source_page',
 'Centrecorp Foundation',
 'https://centrecorpfoundation.com.au/',
 'centrecorpfoundation.com.au', 'foundation-program-monitor',
 168, 8, true, 'high',
 '{"goods_focus": true, "lane": "indigenous-foundation", "notes": "Existing Goods funder — monitor for new programs"}'::jsonb)

ON CONFLICT (source_key) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  target_url = EXCLUDED.target_url,
  parser_hint = EXCLUDED.parser_hint,
  priority = EXCLUDED.priority,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

COMMIT;

-- Verify
SELECT
  metadata->>'lane' AS lane,
  COUNT(*) AS sources,
  COUNT(*) FILTER (WHERE priority >= 7) AS high_priority
FROM source_frontier
WHERE (metadata->>'goods_focus')::boolean = true
GROUP BY 1
ORDER BY 2 DESC;

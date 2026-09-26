-- Clear 83 annual report links a model put on organisation records that are broken or are not an annual report
-- (JusticeHub, 2026-09-27).
--
-- JusticeHub's auto-approve cron (paused 2026-09-26, JusticeHub #517) copied the website-reading model's
-- annual_report_url onto organisation records between 20 May and 10 June with no person checking. Only 8 of the
-- 136 links appear in the text the model read, and 45 are the same guessed path, /annual-reports. Each link was
-- opened on 2026-09-27: of the 134 still on record, 71 are broken (70 answer HTTP 404, one shows a "404" page)
-- and 12 load a page that is not an annual report (About, Our Impact, the ACNC register search page). These 83
-- are cleared. The 37 that lead to an annual reports page, and the 14 on sites that turned the check away
-- (HTTP 202 challenge, 403, 429, 500, 504), are NOT touched.
--
-- The links count for 8% of profile_completeness_score and are read by JusticeHub's annual-reports job, which has
-- a model extract financial figures from them. Figures already extracted (acnc_data.annual_report_facts, 2 of
-- these 83 organisations) are NOT touched here.
--
-- What this does: copies (id, old value, why) to organizations_broken_report_links_20260927 (service role only),
-- then clears exactly those links, and ONLY where the record still holds the link that was checked. Stops if the
-- count is not exactly 83.
--
-- Asked for by Ben 2026-09-27 ("clear the broken report links").
--
-- Apply AFTER this file is on main:
--   scripts/db-apply.sh supabase/migrations/20260927010000_clear_broken_report_links.sql
-- Undo:
--   UPDATE organizations o SET annual_report_url = b.old_value FROM organizations_broken_report_links_20260927 b
--    WHERE o.id = b.id AND o.annual_report_url IS NULL;

BEGIN;
SET LOCAL lock_timeout = '30s';

CREATE TABLE public.organizations_broken_report_links_20260927 AS
SELECT c.id, c.old_value, c.why, now() AS cleared_at
  FROM (VALUES
  ('2b51a3a1-b8b7-4aca-9e91-49606674cae0'::uuid, 'https://www.australiacan.org.au/impact-report', 'does not load (HTTP 404)'),
  ('3717f44e-f7db-4477-86cd-6dc193f2ba99'::uuid, 'https://www.bds.org.au/annual-reports/', 'does not load (HTTP 404)'),
  ('4ff2d9cf-4a45-4611-8582-11f4c617b478'::uuid, 'https://accf.org.au/annual-reports/', 'does not load (HTTP 404)'),
  ('db198a96-f29c-4fd2-9c7c-d8a307e8dd8f'::uuid, 'https://www.stveronica.org.au/annual-report-2025', 'does not load (HTTP 404)'),
  ('0c6d43f2-9172-48d8-a706-99b37019a569'::uuid, 'https://www.legalaid.qld.gov.au/about-us/who-we-are/annual-reports', 'does not load (HTTP 404)'),
  ('532da52a-7542-406a-875d-b50660c1c0a7'::uuid, 'https://primaryethics.com.au/about/annual-reports/', 'does not load (HTTP 404)'),
  ('9f6824f4-7170-452a-91c1-9c76ab5fb261'::uuid, 'https://pcyc.org.au/our-impact', 'loads, but is not an annual report page: Our Impact - PCYC Queensland'),
  ('a11ab2eb-e9b4-43fc-9e20-dbcc301bfcdd'::uuid, 'https://www.beaucare.org.au/annual-reports.html', 'does not load (HTTP 404)'),
  ('a548315f-7795-4b8b-aa11-36e86a1da3bd'::uuid, 'https://youthprojects.org.au/stories/our-impact-in-2025-is-now-live/', 'does not load (HTTP 404)'),
  ('f42a6a4d-ef3c-448e-949e-d6bd5ac5ab02'::uuid, 'http://www.homelessyouth.com.au/annual-reports', 'does not load (HTTP 404)'),
  ('933d5775-ade3-4777-bcde-e2d64b3ec610'::uuid, 'https://centreforwomen.org.au/wp-content/uploads/2023/08/Centre-for-Women-Co-Annual-Report-2022-2023.pdf', 'does not load (HTTP 404)'),
  ('5ff52f51-eeea-4d9f-af29-660e415ffc1a'::uuid, 'https://www.junctionaustralia.org.au/annual-reports/', 'does not load (HTTP 404)'),
  ('5d3e93c3-3cb8-4f29-b0dd-1393d7c32c15'::uuid, 'https://www.aruma.com.au/about-us/our-impact/annual-reports/', 'does not load (HTTP 404)'),
  ('0d8dad4c-8ff8-4575-9289-1132cbf5ed56'::uuid, 'https://www.rslqld.org/about-us/annual-reports', 'loads, but is not an annual report page: About Us | Care, Commemoration and Camaraderie| RSL Queensla'),
  ('3c8906fa-f85c-4b4c-a103-5fe67d9fb44a'::uuid, 'https://www.barnardos.org.au/annual-report/', 'loads a not-found page'),
  ('2e30d95b-a1a0-49bf-92c6-f9b5e5ba0476'::uuid, 'https://www.stmattsmudgee.catholic.edu.au/our-school/annual-school-report', 'does not load (HTTP 404)'),
  ('26f8ab72-79e7-448f-ab38-2a6f8b6655b7'::uuid, 'https://www.childrensground.org.au/evidence-reports/', 'does not load (HTTP 404)'),
  ('50b1da14-3cde-4f0f-a979-c83403f1f3df'::uuid, 'https://www.murdoch.edu.au/about-us/who-we-are/our-impact/annual-report', 'does not load (HTTP 404)'),
  ('2dffb111-65d9-4bb9-bdc1-04c55c8f6286'::uuid, 'https://nacys.asn.au/annual-reports', 'does not load (HTTP 404)'),
  ('002b6e55-d8b4-4f5f-a8a7-fb726ed1a7e7'::uuid, 'https://www.goldenhill.wa.edu.au/admin/annual-report-agm', 'does not load (HTTP 404)'),
  ('532d5680-a61e-4ff4-90ec-ce603bf6af3f'::uuid, 'https://www.stpauls.edu.au/about/annual-reports', 'does not load (HTTP 404)'),
  ('679e3d94-dfc8-47c1-8f94-abacf044d22f'::uuid, 'https://www.stdavidsnc.org.au/annual-reports', 'does not load (HTTP 404)'),
  ('ed71aa82-0ff4-445e-9091-18faef95b0c3'::uuid, 'https://www.mndaustralia.org.au/annual-reports', 'does not load (HTTP 404)'),
  ('8953b8ae-8e81-4a30-b7ab-c759af720f0d'::uuid, 'https://www.rawimpact.org/annual-report', 'does not load (HTTP 404)'),
  ('a6d1010e-1382-496c-9a75-70efe077c01b'::uuid, 'https://www.vicsegnewfutures.org.au/resources/annual-reports', 'does not load (HTTP 404)'),
  ('2529a362-5da3-4f97-b5a8-70e65b0f5deb'::uuid, 'https://www.cornerstonehousing.com.au/wp-content/uploads/2023/07/Cornerstone-Housing-Annual-Report-2022-23-FINAL.pdf', 'does not load (HTTP 404)'),
  ('45ec0a52-f7e2-4b49-9275-548eee7f4b47'::uuid, 'https://adra.org.au/about-us/annual-reports/', 'does not load (HTTP 404)'),
  ('2cadf9ce-becf-4561-ab2a-b4d560adf725'::uuid, 'https://australasiandancecollective.com/assets/reports/annual-report-2025.pdf', 'does not load (HTTP 404)'),
  ('1257e813-ca49-4ac1-a780-56ee840274a0'::uuid, 'https://www.smccab.qld.edu.au/our-college/annual-report', 'does not load (HTTP 404)'),
  ('938d8ed2-f6f5-4fcb-a8ff-f2cf0360ed7f'::uuid, 'https://www.hubcommunity.org.au/publications', 'loads, but is not an annual report page: Hub Community Projects - Publications'),
  ('b37b5d53-0839-40ee-a057-2bdd80cd56c3'::uuid, 'https://redlandscoastmuseum.org.au/wp-content/uploads/2024/07/Redland-Museum-Inc-Annual-Report-2022-2023.pdf', 'does not load (HTTP 404)'),
  ('9b2e676a-d07f-4dce-b295-9e6c401d957a'::uuid, 'https://www.tss.qld.edu.au/school-annual-report', 'does not load (HTTP 404)'),
  ('0a85417a-c23b-4374-b3fd-ca5b83b9e23b'::uuid, 'https://www.quihn.org/annual-reports', 'does not load (HTTP 404)'),
  ('98630885-289f-4d93-a062-b6e1079f762a'::uuid, 'http://www.qyhc.org.au/media-and-publications/', 'does not load (HTTP 404)'),
  ('a8039b74-c55c-4c11-9b2d-23337e2b4c6b'::uuid, 'https://www.regionalhousing.org.au/annual-reports/', 'does not load (HTTP 404)'),
  ('8b3700ee-8f48-43f4-9dcd-edd7990e1e71'::uuid, 'https://www.reframingautism.org.au/about-us', 'loads, but is not an annual report page: About Us - Reframing Autism'),
  ('24f9d3c8-b3dc-49a0-bd74-fe1efe27c25f'::uuid, 'https://www.jawun.org.au/reports', 'loads, but is not an annual report page: Reports &mdash; Jawun'),
  ('ca04e3bd-ca3d-4ac2-92d6-a7d0424cda4b'::uuid, 'https://www.genesis.qld.edu.au/annual-reports', 'does not load (HTTP 404)'),
  ('f153f64b-0567-4226-8469-25f5ae4ed90a'::uuid, 'https://www.caulfieldgs.vic.edu.au/foundation/annual-reports/', 'does not load (HTTP 404)'),
  ('864fb80c-7dcb-41ce-8999-f53e651694a2'::uuid, 'https://www.marysmeals.org.au/annual-report/', 'does not load (HTTP 404)'),
  ('be1c1340-affc-4e8e-a05c-98c3c71fa780'::uuid, 'https://kccc.org.au/annual-reports/', 'does not load (HTTP 404)'),
  ('cee252fa-3ecd-466f-9ce1-1bfc97e9de03'::uuid, 'https://www.bsl.org.au/annual-report', 'does not load (HTTP 404)'),
  ('9502abaa-d986-4761-bfa0-8783f7eb7739'::uuid, 'https://msqld.org.au/about-us/annual-reports/', 'does not load (HTTP 404)'),
  ('f10a913d-8c34-400c-a11d-12db0fedb1b3'::uuid, 'https://kyogletogether.org.au/about', 'loads, but is not an annual report page: About &bull; Kyogle Together Neighbourhood Centre'),
  ('f5602569-4cbe-46c9-aac0-7bfc8498e28c'::uuid, 'https://www.ceda.com.au/About/CEDA-Annual-Reports', 'does not load (HTTP 404)'),
  ('5c99bbfa-b43a-4f1d-a46a-7c3b36450494'::uuid, 'https://www.mcrn.org.au/MCRN%20Annual%20Reports%20&%20Publications', 'does not load (HTTP 404)'),
  ('7f9a4955-483a-4987-a6c3-32588b6ddb34'::uuid, 'https://communify.org.au/annual-reports/', 'does not load (HTTP 404)'),
  ('cbd9796a-25a5-43fc-9427-1017b98b62d1'::uuid, 'https://www.sydneycatholic.org/annual-report/', 'does not load (HTTP 404)'),
  ('38a0ddb9-b6f8-495b-9329-afcd9db01490'::uuid, 'https://www.geelong.ymca.org.au/annual-reports', 'does not load (HTTP 404)'),
  ('df03a3ce-ffb8-44fd-88b5-3026388fa035'::uuid, 'https://www.bluesky.org.au/annual-report/', 'does not load (HTTP 404)'),
  ('984be243-3749-43e3-8ea5-8e7d7c6ddfa9'::uuid, 'https://www.rna.org.au/about-us/annual-reports', 'does not load (HTTP 404)'),
  ('d938eb28-2af5-4aaa-972f-f9cbefe81692'::uuid, 'https://www.yalari.org/annual-reports', 'does not load (HTTP 404)'),
  ('d961333a-69ca-47f8-945d-f703a5060d34'::uuid, 'https://birdlife.org.au/reports/2023-aussie-bird-count-report/', 'loads, but is not an annual report page: 2023 Aussie Bird Count Report - BirdLife Australia'),
  ('45c8b7c5-f5bf-497f-8115-8e8c41c1d85e'::uuid, 'https://www.childrenandmedia.org.au/annual-report', 'does not load (HTTP 404)'),
  ('7f0927f2-277a-4124-b84a-279f868bc4ed'::uuid, 'https://www.mentonegirls.vic.edu.au/about/our-school/annual-reports', 'does not load (HTTP 404)'),
  ('bc6713d1-9935-4bd7-bb9a-8dd9d507405a'::uuid, 'https://naqld.org/about', 'loads, but is not an annual report page: About &#8211; Nutrition Australia'),
  ('2ce832b0-d14b-4f67-beb3-9e457e8f1fb3'::uuid, 'http://bondibeachcottage.com/news/wcs-impact-report-2025/', 'does not load (HTTP 404)'),
  ('50561953-7a29-47a3-b0aa-0170f051dba5'::uuid, 'https://www.saqld.org.au/about/annual-reports', 'does not load (HTTP 404)'),
  ('ff572e59-b2c9-4788-bf10-a02ec49f1369'::uuid, 'https://www.morialtacharitabletrust.org.au/2025-impact-report', 'does not load (HTTP 404)'),
  ('443d46f5-b99b-42dc-adc5-a15243c3df1e'::uuid, 'https://www.sydwestms.org.au/annual-reports', 'does not load (HTTP 404)'),
  ('2668689c-be6f-4503-9cbb-cbb99c4ac23f'::uuid, 'https://www.livingstone.efca.org.au/ls/storage/LS_AnnualReport2025.pdf', 'does not load (HTTP 404)'),
  ('212bf90a-e639-4743-a3fc-bef7934aa222'::uuid, 'https://www.atlassianfoundationinternational.org.au/sustainability-report', 'does not load (HTTP 404)'),
  ('6d4208aa-d74a-4c5e-8f63-4e5e974a3c1f'::uuid, 'https://westernsydney.edu.au/about/our_university/annual_reports', 'does not load (HTTP 404)'),
  ('31c7cee1-a7bd-44a3-b05e-4d15030a05d0'::uuid, 'https://anusa.com.au/about/financial-reports-and-ssaf/', 'does not load (HTTP 404)'),
  ('d7660bd8-6a2c-45da-ad13-c876b9c4e7f8'::uuid, 'https://www.acnc.gov.au/charity/charities', 'loads, but is not an annual report page: Charity Register | ACNC'),
  ('9699b344-03fd-40ff-a1e6-3cda9fffef13'::uuid, 'https://www.mbc.qld.edu.au/annual-reports', 'does not load (HTTP 404)'),
  ('c0eea5d0-d93c-4197-b00c-2176b3be9aa8'::uuid, 'https://www.cpsn.org.au/annual-reports', 'does not load (HTTP 404)'),
  ('0ce96ca9-60fd-4c15-9cbf-3934d297bc7e'::uuid, 'https://create.org.au/who-we-are/our-impact/', 'loads, but is not an annual report page: Our Impact | CREATE Foundation'),
  ('5339f670-7983-4add-9783-f21fd4adb552'::uuid, 'https://www.endeavour.com.au/annual-reports', 'does not load (HTTP 404)'),
  ('4e4e1def-0d3b-45e0-92b8-35dcb36f20a0'::uuid, 'https://www.downsyndrome.org.au/wp-content/uploads/2023/09/DSA-Annual-Report-2022-2023-FINAL.pdf', 'does not load (HTTP 404)'),
  ('240ae748-88a3-4562-a837-9e0f67288bbe'::uuid, 'https://grllen.com.au/annual-reports/', 'does not load (HTTP 404)'),
  ('4fcb1118-c875-4fd8-b1ab-17b211776956'::uuid, 'https://www.mentalhealthaustralia.org.au/wp-content/uploads/2023/08/MHA-Annual-Report-2022-23-FINAL.pdf', 'does not load (HTTP 404)'),
  ('2be7a196-8925-4096-881d-4d2b421f3eea'::uuid, 'https://www.downsyndromensw.org.au/our-impact', 'loads, but is not an annual report page: Down Syndrome NSW : Our Impact'),
  ('d248e9da-9dd7-4b5f-9737-03c339641a9f'::uuid, 'https://www.100schoolproject.org/annual-statements', 'loads, but is not an annual report page: Annual Statements | Hundred School Project'),
  ('bd6a9bff-2626-421a-aa79-3850969826d4'::uuid, 'https://www.brighterlives.org.au/publications', 'does not load (HTTP 404)'),
  ('43aa3f10-75bb-42b0-9b65-aca8a2f40651'::uuid, 'https://www.hallfoundation.org.au/annual-reports', 'does not load (HTTP 404)'),
  ('e519e06a-419a-4a53-aa70-37d106821cc3'::uuid, 'https://www.headspace.org.au/about-us/our-impact/annual-reports/', 'does not load (HTTP 404)'),
  ('691c0718-d7e2-4b2e-82ba-9568fa9b098a'::uuid, 'http://www.meath.org.au/annual-reports', 'does not load (HTTP 404)'),
  ('7a9b3ada-7503-4df5-9ef4-e8b08e6d017f'::uuid, 'https://lisjclism.catholic.edu.au/about/annual-report', 'does not load (HTTP 404)'),
  ('19799143-144a-4f15-b251-0b93e9a0fd8a'::uuid, 'https://cornucopia.org.au/wp-content/uploads/2023/09/Cornucopia-Annual-Report-2022-2023.pdf', 'does not load (HTTP 404)'),
  ('017d352d-7542-4d6f-977e-e866083cebd9'::uuid, 'https://www.kalwun.com.au/planning-and-progress', 'does not load (HTTP 404)'),
  ('4c3a409b-75cf-44b4-bb57-bfe4bc6c314e'::uuid, 'https://www.stjosephsportland.catholic.edu.au/our-school/annual-school-report', 'does not load (HTTP 404)'),
  ('3533821b-b478-4989-9588-480cb34788c1'::uuid, 'https://www.newhorizonstas.org.au/wp-content/uploads/2023/09/NHT-Annual-Report-2022-23.pdf', 'does not load (HTTP 404)')
  ) AS c(id, old_value, why)
  JOIN organizations o ON o.id = c.id AND o.annual_report_url = c.old_value;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM organizations_broken_report_links_20260927;
  IF n <> 83 THEN
    RAISE EXCEPTION 'expected 83 broken report links still in place, found %', n;
  END IF;
END $$;

ALTER TABLE public.organizations_broken_report_links_20260927 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations_broken_report_links_20260927 FROM anon, authenticated;
GRANT SELECT ON public.organizations_broken_report_links_20260927 TO service_role;

UPDATE organizations o SET annual_report_url = NULL
  FROM organizations_broken_report_links_20260927 b
 WHERE o.id = b.id AND o.annual_report_url = b.old_value;

COMMIT;

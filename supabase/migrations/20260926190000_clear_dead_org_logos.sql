-- Clear 185 organisation logo links that do not work (JusticeHub, 2026-09-26).
--
-- Every link below was fetched on 2026-09-26 and failed in a way that will not fix itself: the
-- page is gone (404), the address answers with something that is not an image, the link has no
-- domain, or the address looks invented (a Wix id with repeating characters, a guessed
-- /images/logo.png). 29 other failures that may be temporary (403 refused, unreachable, 5xx, 429)
-- are NOT touched.
--
-- Where they came from: JusticeHub's auto-approve cron applied the website-reading model's
-- suggestions to organisations whenever the model rated its own confidence >= 0.95, with no person
-- and no check that a link loads (617 logos between 20 May and 10 June). It was paused 2026-09-26
-- (JusticeHub #517). Having a logo is worth 10% of profile_completeness_score, so these
-- organisations scored higher for a logo that does not exist; the next rescore corrects that.
--
-- What this does: copies id, the old link and the reason to organizations_dead_logos_20260926
-- (service role only), then sets logo_url = NULL on exactly those rows, and ONLY where the link is
-- still the one that was checked. Stops if the count is not exactly 185.
--
-- Asked for by Ben 2026-09-26 ("clear the dead logos").
--
-- Apply AFTER this file is on main:
--   scripts/db-apply.sh supabase/migrations/20260926190000_clear_dead_org_logos.sql
-- Undo: UPDATE organizations o SET logo_url = b.logo_url
--         FROM organizations_dead_logos_20260926 b WHERE o.id = b.id AND o.logo_url IS NULL;

BEGIN;
SET LOCAL lock_timeout = '30s';

CREATE TABLE public.organizations_dead_logos_20260926 AS
SELECT c.id, c.logo_url, c.why, now() AS cleared_at
  FROM (VALUES
  ('b7a549a8-fdc8-4790-ae18-31b39784eb90'::uuid, 'https://www.yeti.net.au/wp-content/uploads/2021/08/YETI-Logo.png', 'dead (404)'),
  ('f4a1c3b7-8080-4b3c-8d5f-220e5ded891c'::uuid, 'https://pittsworthmensshed.org.au/wp-content/uploads/2022/07/cropped-Pittsworth-Mens-Shed-Logo-1-scaled.jpg', 'dead (404)'),
  ('31c7cee1-a7bd-44a3-b05e-4d15030a05d0'::uuid, 'https://anusa.com.au/wp-content/uploads/2021/07/ANUSA_Logo_Horizontal_ReducedQuality.png', 'dead (404)'),
  ('5e2b8f41-5b22-4d25-9a0c-fea1b3df0644'::uuid, 'https://static.wixstatic.com/media/8b6c3d_4c3e5b5c5f5b4f8e8e8b8e8e8e8e8e8e~mv2.png/v1/fill/w_150,h_100,al_c,usm_0.66_1.00_0.01,enc_auto/Dandelions%20Logo.png', 'invented-looking address; refused (403)'),
  ('5ab14335-3c80-4f5a-8051-9f8b5f4cfd4c'::uuid, 'https://www.weizmann.org.au/wp-content/uploads/2021/04/Weizmann-Australia-Logo.png', 'dead (404)'),
  ('443d46f5-b99b-42dc-adc5-a15243c3df1e'::uuid, '/wp-content/uploads/2022/06/sydwest-logo.png', 'no domain in the link'),
  ('7b8cea43-6eef-4293-9a2d-e8f77d005e39'::uuid, 'https://static1.squarespace.com/static/5f359b84853d71077d2e1a39/t/601e5e5c7b76c0288889f3c2/1612652125615/Millicent+Baptist+Church+Logo.png', 'dead (404)'),
  ('933d5775-ade3-4777-bcde-e2d64b3ec610'::uuid, 'https://centreforwomen.org.au/wp-content/uploads/2023/07/Centre-for-Women-Co-Logo.png', 'dead (404)'),
  ('c5385ef6-a273-4a9e-a0a0-c5e7475fd910'::uuid, 'https://cdn.shopify.com/s/files/1/0534/3079/8890/files/F4Y_Logo_180x.png?v=1672016757', 'dead (404)'),
  ('fa16de35-1d53-463e-b56c-104fb0d50183'::uuid, 'https://www.fremantlesurfclub.com.au/wp-content/uploads/2022/05/Fremantle-SLSC-Logo.png', 'dead (404)'),
  ('cfc7c50f-809e-456e-8d4b-87cf7b43ae19'::uuid, 'https://www.pledgefortheplanet.org/images/logo.svg', 'invented-looking address; dead (404)'),
  ('39655c14-e773-4cda-b229-cf5f71bcdad9'::uuid, 'https://www.desertpeamedia.com/images/logo.png', 'invented-looking address; dead (404)'),
  ('8583e153-0513-47ba-9fda-14bbbe16bd7b'::uuid, 'https://monash.cmca.org.au/wp-content/uploads/2020/02/cropped-Cropped-Logo-270-x-100.png', 'dead (404)'),
  ('28598a56-ad3c-4ea5-ba8a-6e478eb8c6fb'::uuid, 'https://www.alphadog.com.au/images/logo.png', 'invented-looking address; dead (404)'),
  ('ee81d469-97eb-456c-9b2e-78135c6b5054'::uuid, 'https://www.campbelltowncityband.org/wp-content/uploads/2021/04/campbelltown-city-band-logo.png', 'dead (404)'),
  ('60f0eac3-775f-40f6-a1bb-6d5720a79500'::uuid, 'https://www.groundswellgiving.org/wp-content/uploads/2022/04/Groundswell-Giving-Logo-2022.png', 'dead (404)'),
  ('907ef5ab-f744-44e9-8d60-2e852cf3f058'::uuid, 'https://www.ozcare.org.au/wp-content/uploads/2021/04/ozcare-logo.png', 'dead (404)'),
  ('d7b5ac3d-ae13-4633-a08f-0e0b076c97ab'::uuid, 'https://www.acia.net.au/assets/images/acia-logo.png', 'dead (404)'),
  ('533d3519-5efa-42fc-81f5-0667585fd58d'::uuid, 'https://www.amhc.org.au/assets/images/logo.png', 'dead (404)'),
  ('96ba78a8-591a-46b1-a1ab-7dbd3f89b06f'::uuid, 'https://static1.squarespace.com/static/5f9a9a8c8120e02e7a7e1a1e/t/60b1e5d4f5b3a21e5f8e8a3d/1622320598010/Spirit+of+Woman+Logo+2021.png', 'dead (404)'),
  ('838b208b-0353-4e25-9134-d0ad2720dce2'::uuid, 'https://static.wixstatic.com/media/1d1e00_2b1e1c3e0a8a4f0d8f1f3e1e1c3e0a8a~mv2.png', 'invented-looking address; refused (403)'),
  ('9fc9c876-7bfa-4d1c-a698-63175d36722b'::uuid, 'https://www.havannahhouse.org.au/wp-content/uploads/2022/01/cropped-Havannah-House-Ministries-Logo-1.png', 'dead (404)'),
  ('b404fac4-b56d-4133-ab04-dff592cefa4b'::uuid, 'https://www.stlukesliverpool.org.au/wp-content/uploads/2021/02/stlukes-logo.png', 'dead (404)'),
  ('ded23cd9-a16b-484f-925a-6648e0a02d48'::uuid, 'https://www.salvationarmy.org.au/themes/salvos/images/salvos-logo.svg', 'dead (404)'),
  ('8531137f-46b5-4f4c-b420-879bba168851'::uuid, 'https://static.wixstatic.com/media/1e8b7c_2e6d8f8e1c4f4f0d8e5b5e5f5b5e5f5b~mv2.png', 'invented-looking address; refused (403)'),
  ('4ebb466d-b3b3-4902-8de5-3247ef7db1f9'::uuid, 'https://www.swrslsc.com.au/wp-content/uploads/2021/07/swrslsc-logo.png', 'dead (404)'),
  ('5102368c-dd81-42fd-9e20-e1159375997d'::uuid, 'https://nwbc.net.au/images/logo.png', 'invented-looking address; dead (404)'),
  ('a2bc9dfc-9627-4c46-99a7-6658b2f7429b'::uuid, 'https://aima.org.au/wp-content/uploads/2022/07/cropped-AIMA-Logo-Transparent.png', 'dead (404)'),
  ('3717f44e-f7db-4477-86cd-6dc193f2ba99'::uuid, 'https://www.bds.org.au/wp-content/uploads/2021/04/BDS-Logo-2021.png', 'dead (404)'),
  ('a8794a7e-743c-4ad6-80fc-6edaee58dfe4'::uuid, '/assets/images/serag-logo.png', 'no domain in the link'),
  ('a75afd52-3a3d-4298-9f46-475476cfcf51'::uuid, 'https://www.childhood.org.au/wp-content/uploads/2022/04/ACF-Logo-Horizontal-Colour.png', 'dead (404)'),
  ('5ff52f51-eeea-4d9f-af29-660e415ffc1a'::uuid, 'https://www.junctionaustralia.org.au/wp-content/uploads/2022/06/Junction-Logo.png', 'dead (404)'),
  ('6812d83c-c5d9-451d-a0aa-de2868b95ed7'::uuid, 'https://actofrecognition.org.au/wp-content/uploads/2022/05/Act-of-Recognition-Logo.png', 'dead (404)'),
  ('5d3e93c3-3cb8-4f29-b0dd-1393d7c32c15'::uuid, 'https://www.aruma.com.au/wp-content/uploads/2022/07/aruma-logo.svg', 'dead (404)'),
  ('0154d976-7f1a-4631-8ce5-76ae404e4335'::uuid, 'https://heritagecc.com.au/wp-content/uploads/2021/08/Heritage-Christian-Centre-Logo.png', 'not an image (text/html)'),
  ('1a382e6a-d34b-4cf1-ac41-3276940bf4c3'::uuid, 'https://www.bluelight.org.au/wp-content/uploads/2023/07/BLV-Logo-2023.png', 'dead (404)'),
  ('36b4260d-62de-4ffe-be7d-01cc081c8463'::uuid, 'https://static1.squarespace.com/static/5f3c4e637bfe6e410c88f6d6/t/607c6e5b6328fe4788932237/1618755165206/Studio+ARTES+Logo+Horizontal+2021.png', 'dead (404)'),
  ('6ba50a81-879c-4afd-a417-486dc61dc759'::uuid, '/static/logo.svg', 'no domain in the link'),
  ('002b6e55-d8b4-4f5f-a8a7-fb726ed1a7e7'::uuid, 'https://www.goldenhill.wa.edu.au/uploads/images/logo.png', 'dead (404)'),
  ('a6d1010e-1382-496c-9a75-70efe077c01b'::uuid, 'https://www.vicsegnewfutures.org.au/wp-content/uploads/2021/04/VICSEG-New-Futures-Logo.png', 'dead (404)'),
  ('d248e9da-9dd7-4b5f-9737-03c339641a9f'::uuid, 'https://www.100schoolproject.org/images/logo.png', 'invented-looking address; dead (404)'),
  ('3317380e-683f-4a4c-ab41-9f77b103b00d'::uuid, 'https://www.rtc.edu.au/wp-content/uploads/2021/04/RTC-Logo-Colour.png', 'dead (404)'),
  ('e10c2f7a-c446-431c-b16c-79a61b959746'::uuid, 'https://www.passingthrough.net/wp-content/uploads/2022/01/logo.png', 'dead (404)'),
  ('a62ec08c-d07e-456a-ac53-e11ed94a73b9'::uuid, 'https://cdn.shopify.com/s/files/1/0538/5671/9703/files/SFC_LOGO_BLACK_1200x.png?v=1677737293', 'dead (404)'),
  ('cc965d80-f1f7-458d-9568-7e8df325868d'::uuid, 'http://www.speldsa.org.au/wp-content/uploads/2021/06/SPELD-SA-Logo.png', 'dead (404)'),
  ('dee014bf-e68b-41f1-8556-8f19f829dbf8'::uuid, 'https://images.squarespace-cdn.com/content/v1/6457e69c0749c565c73e2a8a/6e5f9a8e-1c5d-4a8d-9c5c-4f5b5e5c5c5d/logo.png', 'dead (404)'),
  ('c4ef4364-48fd-40eb-bd18-654b0ca6eccb'::uuid, 'https://www.backtrack.org.au/wp-content/uploads/2020/09/BackTrack-Logo-2020.png', 'not an image (text/html)'),
  ('e831d528-dae7-4be7-8570-c8459677f282'::uuid, 'https://u3ayarracity.org.au/assets/images/u3a-logo.png', 'not an image (text/html)'),
  ('15f44b77-4faa-4b4d-86c2-9a2b136445e0'::uuid, 'https://tsanz.com.au/wp-content/uploads/2022/04/TSANZ-Logo-Horizontal-300x115.png', 'not an image (text/html)'),
  ('2b51a3a1-b8b7-4aca-9e91-49606674cae0'::uuid, 'https://www.australiacan.org.au/wp-content/uploads/2022/05/CANA-Logo-Horizontal-Colour.png', 'dead (404)'),
  ('76ef2e32-a9a3-4245-9018-2db8eb64cd4c'::uuid, 'https://www.mcwh.com.au/wp-content/themes/mcwh/assets/images/logo.svg', 'dead (404)'),
  ('8a84f3d5-d90c-4695-a41e-83224bae251c'::uuid, 'https://www.zoemedicalfoundation.org.au/images/logo.png', 'invented-looking address; dead (404)'),
  ('ddf9d4f1-9428-4080-9925-a75c7797bab1'::uuid, 'https://static1.squarespace.com/static/5f9eaa99d19f9f2e4f1e9a9e/t/601c3e5b68c68e48869577f2/1612463708770/Nimmitabel+Preschool+Logo.png', 'dead (404)'),
  ('9f6824f4-7170-452a-91c1-9c76ab5fb261'::uuid, 'https://pcyc.org.au/wp-content/uploads/2022/05/PCYC-Queensland-Logo.png', 'dead (404)'),
  ('bf38c2e2-a1d8-4d35-9f83-5b2dd9a0545e'::uuid, 'https://nbri.com.au/wp-content/uploads/2022/07/NBRI-Logo.png', 'dead (404)'),
  ('97904486-7d39-44a8-a040-7e0cd8ba9b9f'::uuid, 'https://livecitychurch.com/wp-content/uploads/2021/08/LiveCity-Church-Logo-2021.png', 'dead (404)'),
  ('47299f9a-da81-4238-bdc7-8c827a88a3c4'::uuid, 'https://www.cavinc.com.au/main/wp-content/uploads/2020/07/CAV-Logo.png', 'dead (404)'),
  ('dbcbe33b-f32e-46ad-a237-9ac478fd5047'::uuid, 'https://yirara.nt.edu.au/wp-content/uploads/2022/03/Yirara-College-Logo.png', 'dead (404)'),
  ('221b723e-d894-4c0c-aa8e-59221acc67c2'::uuid, 'https://www.uniting.org/themes/custom/uniting/logo.svg', 'dead (404)'),
  ('db198a96-f29c-4fd2-9c7c-d8a307e8dd8f'::uuid, 'https://www.stveronica.org.au/images/st-veronica-logo.png', 'dead (404)'),
  ('8040f348-57d2-404a-8b69-89148301a596'::uuid, 'https://www.qatsicpp.com.au/wp-content/uploads/2020/06/qatsicpp-logo.png', 'not an image (text/html)'),
  ('6f90d1b2-66a0-4891-8e27-e48a009f000a'::uuid, 'https://nhwact.org.au/wp-content/uploads/2022/05/NHW-ACT-Logo.png', 'dead (404)'),
  ('cbd9796a-25a5-43fc-9427-1017b98b62d1'::uuid, 'https://www.sydneycatholic.org/wp-content/uploads/2021/07/cropped-Sydney-Catholic-Archdiocese-Logo-192x192.png', 'dead (404)'),
  ('828149b5-6c29-4d02-ba1f-fc9177e62caf'::uuid, 'https://www.brake.org.au/wp-content/uploads/2021/06/Brake-Logo-2021.png', 'dead (404)'),
  ('80cc8c7c-f1b8-45b0-bb8f-405fb6e47285'::uuid, 'https://www.clearmindopenheart.org/wp-content/uploads/2021/06/clear-mind-open-heart-logo.png', 'dead (404)'),
  ('3533821b-b478-4989-9588-480cb34788c1'::uuid, 'https://www.newhorizonstas.org.au/wp-content/uploads/2022/04/New-Horizons-Logo-2022.png', 'dead (404)'),
  ('26f8ab72-79e7-448f-ab38-2a6f8b6655b7'::uuid, 'https://www.childrensground.org.au/wp-content/uploads/2022/04/cropped-CG-Logo-Transparent-1.png', 'dead (404)'),
  ('32b7e0b7-022c-4f5a-b87c-c56727c1c765'::uuid, 'https://www.cfqld.org.au/wp-content/uploads/2021/04/cfqld-logo.png', 'not an image (text/html)'),
  ('883303f3-b748-4c01-a3b4-ca5223bd8677'::uuid, 'https://www.gegac.org.au/wp-content/uploads/2021/03/GE-GAC-Logo.png', 'not an image (text/html)'),
  ('33ff2d93-b222-4722-a952-97074e10dc5f'::uuid, 'https://hrlc.org.au/wp-content/uploads/2021/09/HRLC-logo-horizontal.svg', 'dead (404)'),
  ('354c87ff-e473-4b3e-96b4-e45ef4af08f7'::uuid, 'https://amosa.org.au/wp-content/uploads/2021/06/AMOSA-Logo-Web.png', 'dead (404)'),
  ('5920564b-03cb-4aae-84bd-c42a052c8ac6'::uuid, 'http://www.pgp.org.au/wp-content/uploads/2022/05/PGP-Logo-2022.png', 'dead (404)'),
  ('98cd6b55-d77c-4f98-9858-3e1cc71b3fbb'::uuid, 'https://ntshelter.org.au/wp-content/uploads/2020/07/NTSHelter-Logo.png', 'dead (404)'),
  ('8b38c6f8-d1da-4acf-99fe-11f9f3c7753c'::uuid, 'https://www.unitingvictas.org.au/wp-content/uploads/2021/06/Uniting-VicTas-logo.svg', 'dead (404)'),
  ('50f3d6cc-445b-4c2b-bb44-0b741a3af402'::uuid, 'https://static.wixstatic.com/media/1e8b4d_7c7e3d8f1f5a4a8e8e8e8e8e8e8e8e8e~mv2.png', 'invented-looking address; refused (403)'),
  ('036087b4-bb44-471b-97ef-1b862d307234'::uuid, 'https://www.meca.org.au/wp-content/uploads/2021/08/MECA-Logo-2021.png', 'not an image (text/html)'),
  ('b86f2081-e03a-4837-8797-093223af550e'::uuid, 'https://www.wayjo.com/wp-content/uploads/2021/02/WAYJO-Logo-2021-Web.png', 'dead (404)'),
  ('4c572f19-35b6-4457-8fc4-5253c077e3c3'::uuid, 'https://www.isb.org.au/wp-content/uploads/2021/06/cropped-ISB-Logo-270x140.png', 'dead (404)'),
  ('ec98a76d-8964-47f8-8ad8-917ba6a786b5'::uuid, 'https://mannifera.org.au/wp-content/uploads/2023/09/mannifera-logo-horizontal-white.png', 'dead (404)'),
  ('4e4e1def-0d3b-45e0-92b8-35dcb36f20a0'::uuid, 'https://www.downsyndrome.org.au/wp-content/uploads/2021/05/DSA_Logo_Horizontal_Red_300dpi.jpg', 'dead (404)'),
  ('5161ce61-da2e-4049-9fe8-26359ca8f5d5'::uuid, '/images/scofc-logo.png', 'no domain in the link'),
  ('5df14efb-eba8-4275-bb7e-ff6ba14649be'::uuid, 'https://wathaurong.org.au/wp-content/uploads/2021/03/Wathaurong-Logo.png', 'dead (404)'),
  ('5ef4fe82-a7f5-4dc1-808a-ac515ded2141'::uuid, 'https://bacc.org.au/wp-content/uploads/2020/09/BACC-Logo.png', 'not an image (text/html)'),
  ('c05ce89f-ab47-4a4b-a0d8-5c87b2bc7539'::uuid, 'https://www.riversgift.com/wp-content/uploads/2022/08/Rivers-Gift-Logo-2022.png', 'dead (404)'),
  ('353cb3ef-9454-4656-b7f9-88998c59ead4'::uuid, 'https://cdn.sanity.io/images/0j19h9o8/production/7f5c8f8c5c8e5b5e5e5b5e5b5e5b5e5b5e5b5e5b-1000x200.svg', 'dead (404)'),
  ('2529a362-5da3-4f97-b5a8-70e65b0f5deb'::uuid, 'https://www.cornerstonehousing.com.au/wp-content/uploads/2022/07/Cornerstone-Housing-Logo-2022.png', 'dead (404)'),
  ('a9073bb8-ec1c-4095-a9b7-ce6ba0a3988a'::uuid, 'https://entertainmentassist.org.au/wp-content/uploads/2021/05/EA-Logo-Horizontal-Colour.png', 'dead (404)'),
  ('53eab5f8-7c2f-4508-9310-fefc5a7b47b7'::uuid, 'http://www.catholiccarent.org.au/wp-content/uploads/2021/05/catholiccare-logo.png', 'dead (404)'),
  ('8953b8ae-8e81-4a30-b7ab-c759af720f0d'::uuid, 'https://rawimpact.org/wp-content/uploads/2023/09/RAW-Impact-Logo-White.png', 'dead (404)'),
  ('faf818b8-ce88-4d70-9e57-9c8310c1e9cd'::uuid, 'https://static.wixstatic.com/media/8e0c0d_2f2e3d5e6f3b4f0b9b5e5f5b5e5f5b5d~mv2.png', 'invented-looking address; refused (403)'),
  ('367a6654-af07-4890-a765-aeb0ac847619'::uuid, 'https://cdn.shopify.com/s/files/1/0708/7822/3333/files/Nja-marl%C3%A9ya_Logo_180x.png?v=1729970732', 'dead (404)'),
  ('3f5112f5-6046-4263-ab3f-aa10bbff7679'::uuid, 'https://cerebralpalsy.org.au/wp-content/uploads/2022/05/CPA-Logo-Vertical-Colour.png', 'dead (404)'),
  ('2c603ed0-7ab4-4231-b100-12c6c4733fe7'::uuid, 'https://www.odyssey.org.au/wp-content/uploads/2022/06/odyssey-logo.png', 'not an image (text/html)'),
  ('a548315f-7795-4b8b-aa11-36e86a1da3bd'::uuid, 'https://youthprojects.org.au/wp-content/uploads/2021/04/Youth-Projects-Logo.png', 'dead (404)'),
  ('5255088b-9bca-459e-aa8f-7a042778914c'::uuid, 'https://www.njt.org.au/wp-content/uploads/2022/10/NJT_Logo_Horizontal_Reduced-1.png', 'dead (404)'),
  ('3268dacd-3b5e-4e9d-be4a-579bedb8888d'::uuid, 'https://www.johncolet.nsw.edu.au/wp-content/uploads/2020/07/johncolet-logo-300x300.png', 'not an image (text/html)'),
  ('f8a0cd3c-6afd-4356-94f7-d476bc0fc907'::uuid, 'https://www.cambodiankidsfoundation.org/wp-content/uploads/2021/06/CKF-Logo.png', 'dead (404)'),
  ('17dbe0be-4a03-49a4-b85d-ced371f64a89'::uuid, 'https://www.nquc.org/wp-content/uploads/2022/07/nquc-logo.png', 'not an image (text/html)'),
  ('c27f3cef-bf02-428e-a662-e0ea8d9b7290'::uuid, 'https://momentummentalhealth.com.au/wp-content/uploads/2023/08/cropped-Momentum-Mental-Health-Logo-1.png', 'dead (404)'),
  ('9cc641d7-2b5d-4331-873e-613327f35227'::uuid, 'http://www.ahcsa.org.au/assets/images/AHCSA-Silhouette-R.svg', 'dead (404)'),
  ('f09511ff-f0c7-48bb-809a-125e6624257b'::uuid, 'https://www.wishanimalrescue.org.au/wp-content/uploads/2018/12/cropped-wish-bright-red-1-180x180.png', 'dead (404)'),
  ('5236f33d-0aa9-43e8-a525-2e8e5ed55dfd'::uuid, 'https://www.phoenixlsa.org.au/wp-content/uploads/2021/08/Phoenix-Logo-300x138.png', 'not an image (text/html)'),
  ('f2f280d4-020c-4ad2-a8ec-74ad2211c767'::uuid, 'https://playfordtrust.com.au/wp-content/uploads/2022/07/Playford-Trust-Logo.png', 'dead (404)'),
  ('386147a8-b555-421b-ae13-d64b4da6ebeb'::uuid, 'https://nswturkishwelfare.org.au/wp-content/uploads/2020/9/Logo.png', 'dead (404)'),
  ('98630885-289f-4d93-a062-b6e1079f762a'::uuid, 'http://www.qyhc.org.au/wp-content/uploads/2021/06/QYHC_Logo.png', 'dead (404)'),
  ('45ec0a52-f7e2-4b49-9275-548eee7f4b47'::uuid, 'https://adra.org.au/wp-content/uploads/2023/04/ADRA-Australia-Logo.png', 'dead (404)'),
  ('3c8906fa-f85c-4b4c-a103-5fe67d9fb44a'::uuid, 'https://www.barnardos.org.au/wp-content/uploads/2021/08/Barnardos-Australia-Logo.png', 'dead (404)'),
  ('13d4b84f-08eb-42f4-9dca-7240d00768cf'::uuid, 'https://guitarsgatheringdust.com/wp-content/uploads/2026/04/IMG_9436-copy-scaled.jpg', 'not an image (text/html)'),
  ('9cf66a63-8f7c-4c0f-8a1b-3865524f7cef'::uuid, 'https://christianunion.org.au/wp-content/uploads/2023/02/cu-logo-2.jpg', 'dead (404)'),
  ('2d6b7116-4a5a-41c3-8ac0-9342e1c9d0f5'::uuid, 'https://missionworx.org.au/wp-content/uploads/2023/09/cropped-Missionworx-logo-square-with-transparent-background-small-180x180.gif', 'not an image (text/html)'),
  ('4cc1fb92-576b-437b-8351-1926d14b9995'::uuid, 'https://www.cfaq.com.au/wp-content/uploads/2023/07/cfaq-logo.png', 'dead (404)'),
  ('672b32be-8559-4465-804e-d447839fe7c7'::uuid, 'https://www.digitalsocietyfoundation.org/wp-content/uploads/2022/05/cropped-Digital-Society-Foundation-Logo-1.png', 'dead (404)'),
  ('6bfe93d5-812b-4cc0-945d-f5b54ff47fc7'::uuid, 'https://www.procantech.com/wp-content/uploads/2023/07/ProCan-Technologies-Logo.png', 'dead (404)'),
  ('6d2d9038-44a6-477d-9eb0-558ce0cbe818'::uuid, 'https://www.fernvalechurch.org.au/wp-content/uploads/2018/11/logo.png', 'dead (404)'),
  ('6d4208aa-d74a-4c5e-8f63-4e5e974a3c1f'::uuid, 'https://www.westernsydney.edu.au/__data/assets/image/0009/444444/logo.png', 'dead (404)'),
  ('72ce6483-a817-49b4-b3e9-a8aa04a01616'::uuid, 'https://www.phoenixaustralia.org/wp-content/uploads/2021/04/phoenix-australia-logo.png', 'not an image (text/html)'),
  ('74470124-7936-4e25-98d6-f2761c0d176b'::uuid, 'https://dukeofed.com.au/wp-content/uploads/2023/08/Duke-of-Edinburghs-Logo-White.png', 'dead (404)'),
  ('7f9a4955-483a-4987-a6c3-32588b6ddb34'::uuid, 'https://communify.org.au/wp-content/uploads/Communify-Logo.png', 'dead (404)'),
  ('9e5b7ec7-cfc7-489c-907b-35822d3e0292'::uuid, 'https://manningvalley.u3anet.org.au/wp-content/uploads/sites/28/2021/06/Logo-Manning-Valley.png', 'not an image (text/html)'),
  ('8c1a38a6-9a77-43df-9757-a69b21354fd6'::uuid, 'https://communitysolutions.org.au/wp-content/uploads/2022/05/Community-Solutions-Logo.png', 'dead (404)'),
  ('a44a1aac-c680-4130-8873-f9275e15b2b1'::uuid, 'https://sbctc.com.au/wp-content/uploads/2022/07/SBCTC-Logo.png', 'dead (404)'),
  ('5339f670-7983-4add-9783-f21fd4adb552'::uuid, 'https://www.endeavour.com.au/hs-fs/hubfs/1.%20Endeavour%20Website/Global/Header/logo-endef-blue.svg', 'dead (404)'),
  ('0ce96ca9-60fd-4c15-9cbf-3934d297bc7e'::uuid, 'https://create.org.au/wp-content/uploads/2021/09/CREATE-Logo-2021.png', 'dead (404)'),
  ('f42a6a4d-ef3c-448e-949e-d6bd5ac5ab02'::uuid, 'https://cdn.shopify.com/s/files/1/0070/7741/7237/files/YO_Logo_180x.png?v=1655735594', 'dead (404)'),
  ('b78ce221-f36d-4556-a4c5-2a955a744246'::uuid, 'https://www.lifesanctuary.church/wp-content/uploads/2021/07/lsc-logo.png', 'dead (404)'),
  ('da88f574-be5a-406f-a6c0-bb25718b6d2a'::uuid, 'https://vpginc.com.au/wp-content/uploads/2021/08/VPG-Logo-2021.png', 'dead (404)'),
  ('cee252fa-3ecd-466f-9ce1-1bfc97e9de03'::uuid, 'https://www.bsl.org.au/themes/custom/bsl/logo.svg', 'dead (404)'),
  ('f5602569-4cbe-46c9-aac0-7bfc8498e28c'::uuid, 'https://www.ceda.com.au/Global/CEDA%20Logos/CEDA_Logo_Horizontal_RGB.png', 'dead (404)'),
  ('db986639-3f2b-47e7-b73f-915745502080'::uuid, 'https://jodiesinspiration.com.au/wp-content/uploads/2021/04/jodies-logo-2.png', 'dead (404)'),
  ('dc11f70d-10d0-4b13-b153-99eaf6ae3641'::uuid, 'https://www.jacarandacommunitycentre.org.au/images/logo.jpg', 'invented-looking address; dead (404)'),
  ('e52dcc45-0e79-42a2-b056-f0e872427060'::uuid, 'https://www.carevan.com.au/wp-content/uploads/2021/08/carevan-logo.png', 'dead (404)'),
  ('e7473394-83c2-4326-bd7e-bc17a5f26939'::uuid, 'https://www.hopeforchildren.org.au/src/images/header-logo-2x.jpg', 'dead (404)'),
  ('e7ea70e3-c5a4-4614-abe5-e62bed10928f'::uuid, 'https://static.wixstatic.com/media/110621_11111111111111111111111111111111.png/v1/fill/w_100,h_100,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/110621_11111111111111111111111111111111.png', 'invented-looking address; refused (403)'),
  ('ec08dbf4-a5fc-4530-ba5b-2c7f16148d3a'::uuid, 'https://www.theralifoundation.org.au/images/logo.png', 'invented-looking address; dead (404)'),
  ('9e7553b9-a23c-4e55-ba77-2ff3ac4e7b36'::uuid, 'https://www.kokodayouthfoundation.com/wp-content/uploads/2021/04/KYF-Logo.png', 'dead (404)'),
  ('a82d583a-0503-4beb-bfbe-a14ff4919c30'::uuid, 'https://crslsb.org.au/wp-content/uploads/2023/07/cropped-Cairns-RSL-favicon-180x180.png', 'dead (404)'),
  ('9c07f324-e3e8-41dc-9281-2b789e8fff18'::uuid, 'https://neerimhealth.org.au/wp-content/uploads/2021/09/favicon-logo.png', 'dead (404)'),
  ('b4e5eb8b-4d89-4c87-b574-92ca7107200c'::uuid, 'https://highlands.qld.edu.au/wp-content/uploads/2021/08/Highlands-Christian-College-Logo.png', 'dead (404)'),
  ('f7f8842e-c2f3-48f7-98c7-bbe126a5fcb3'::uuid, 'https://whitfieldkindy.org.au/wp-content/uploads/2023/05/cropped-Whitfield-Community-Kindy-Logo-1.png', 'dead (404)'),
  ('0750501c-5975-444a-93ba-8cf599253370'::uuid, 'https://chinchillakindy.com/wp-content/uploads/2023/07/chinchilla-kindy-logo.png', 'not an image (text/html)'),
  ('70615d03-9283-41fb-8536-301a02de1b15'::uuid, 'https://www.gladstonewomenshealth.org.au/svgs/logo.svg', 'dead (404)'),
  ('cb6372da-2341-47f4-bc71-1b995633c214'::uuid, 'https://www.smartpups.org.au/wp-content/uploads/2020/08/Smart-Pups-Logo.png', 'not an image (text/html)'),
  ('bc41799f-fb79-412f-88e8-9f76a8bf338a'::uuid, 'http://www.tmcca.com.au/wp-content/uploads/2021/05/TMCCA-Logo.png', 'not an image (text/html)'),
  ('22525ef2-c7b0-4d59-a2d5-ce1f95f4875d'::uuid, 'https://www.friendsofqueensparkbushland.org.au/wp-content/uploads/2021/08/FoQPB-Logo-2021.png', 'dead (404)'),
  ('2e7611a6-f80e-4278-94c0-1bdd9315b17a'::uuid, 'https://nagfoundation.org.au/wp-content/uploads/2021/08/NAGF-Logo-300x138.png', 'dead (404)'),
  ('bd765fc8-d17f-4d19-9f08-2de72b62213b'::uuid, 'http://www.nowrashow.org.au/wp-content/uploads/2022/02/Nowra-Show-Society-Logo.png', 'not an image (text/html)'),
  ('cbb0e622-74c2-4e16-8ccb-d1088fddf419'::uuid, 'https://mackayanimalrescue.com.au/wp-content/uploads/2022/07/cropped-MARS-Logo-1-scaled.jpg', 'not an image (text/html)'),
  ('9821ce69-811d-4180-b9b8-eaa855855183'::uuid, 'https://www.kingscommunity.care/wp-content/uploads/2022/07/Kings-Community-Care-Logo.png', 'dead (404)'),
  ('fe9b1659-148d-4a7e-9b7a-0692abffa874'::uuid, 'https://www.pointlookoutslsc.com.au/wp-content/uploads/2022/08/cropped-PLSLSC-Logo-360x180.png', 'dead (404)'),
  ('7b89b740-9678-4f9b-972b-f5d308748092'::uuid, 'https://albanyshow.org.au/wp-content/uploads/2021/03/cropped-Albany-Show-Logo-1.png', 'dead (404)'),
  ('aa100ecb-2e55-40e3-89a1-c4dd347327d9'::uuid, 'https://www.aussiehelpers.org.au/wp-content/uploads/2023/04/Aussie-Helpers-Logo.png', 'not an image (text/html)'),
  ('78bbea67-9037-4525-96b7-d4234178424f'::uuid, 'https://goldcoastpotters.com/wp-content/uploads/2021/06/cropped-GCPA-Logo-1-scaled.jpg', 'dead (404)'),
  ('0a85417a-c23b-4374-b3fd-ca5b83b9e23b'::uuid, 'https://www.quihn.org/wp-content/uploads/2021/05/quihn-logo.png', 'dead (404)'),
  ('0c6d43f2-9172-48d8-a706-99b37019a569'::uuid, 'https://www.legalaid.qld.gov.au/-/media/images/logo.png', 'dead (404)'),
  ('532d5680-a61e-4ff4-90ec-ce603bf6af3f'::uuid, 'https://www.stpauls.edu.au/wp-content/uploads/2021/07/st-pauls-college-logo.png', 'dead (404)'),
  ('2d19944d-7a78-44db-af7f-5a7e48fd87b8'::uuid, 'https://tas.relationships.org.au/wp-content/themes/theme/static/images/logo.svg', 'dead (404)'),
  ('e2cdfcb3-6d9a-44ce-8ef4-59165ff63123'::uuid, 'https://4rr.com.au/wp-content/uploads/2022/05/cropped-4RR-FM-Logo-1.png', 'dead (404)'),
  ('069b3682-db32-4010-9dc9-be7fad52abd9'::uuid, 'https://allora.show/wp-content/uploads/2023/03/cropped-Allora-Show-Logo-300x138.png', 'dead (404)'),
  ('2d0c6c3e-fe30-4c81-8057-db363156bb3d'::uuid, 'https://arsf.com.au/wp-content/uploads/2020/03/ARSF-Logo.png', 'dead (404)'),
  ('080d4852-ca09-48c5-9e2c-cc7c7a708fa8'::uuid, 'https://autismgoldcoast.com.au/wp-content/uploads/2023/05/logo.png', 'not an image (text/html)'),
  ('582bfd61-7fb9-4911-8c67-836cab86e88d'::uuid, 'https://sailabilitydd.my.canva.site/_assets/images/725b756a69a7d4c235070e51acd85560.png', 'dead (404)'),
  ('25adb97b-da70-4301-9f3c-3d4062d76208'::uuid, 'https://magsq.com.au/wp-content/uploads/2023/07/MAGSQ-Logo.png', 'dead (404)'),
  ('42a47a18-83b5-4b27-b0f5-a39eb7ba36d1'::uuid, 'https://www.rasa.org.au/wp-content/uploads/2022/05/RASA-Logo-White-e1652279389401.png', 'dead (404)'),
  ('0655fe97-84dc-4066-ad44-79443a0b0585'::uuid, 'https://whiteboxenterprises.com.au/wp-content/uploads/2022/01/WBE_Apple-Touch_icon.png', 'dead (404)'),
  ('bd71c269-8bcd-434d-9643-95286793792d'::uuid, 'https://wsmrc.org.au/wp-content/uploads/2021/06/WSMRC-Logo.png', 'dead (404)'),
  ('d7314236-0b0f-4f6a-b275-996e853902d9'::uuid, 'https://gundykindy.com.au/wp-content/uploads/2023/02/cropped-Goondiwindi-Kindergarten-Logo-1.png', 'dead (404)'),
  ('3720008c-34fd-4226-962f-6882deb61dfc'::uuid, 'https://sheppaccess.com.au/wp-content/uploads/2020/07/logo.png', 'dead (404)'),
  ('d938eb28-2af5-4aaa-972f-f9cbefe81692'::uuid, 'https://www.yalari.org/wp-content/uploads/2021/04/Yalari-Logo-2021.png', 'dead (404)'),
  ('ba8e4ad1-5cfa-400b-8107-f20ab14a0b3d'::uuid, 'https://warrina.org.au/wp-content/uploads/2021/08/Warrina-Logo-2021.png', 'dead (404)'),
  ('d3f61e26-08d5-46c2-a429-d7f64269e469'::uuid, 'https://www.chronicpainaustralia.org.au/wp-content/uploads/2021/08/CPA-Logo-Horizontal-300x109.png', 'not an image (text/html)'),
  ('edd62462-115e-4c36-86e6-18665bfb2a5c'::uuid, 'https://www.boltonpointchildcare.com.au/wp-content/uploads/2021/02/BPCC-Logo.png', 'dead (404)'),
  ('0128baf1-a611-4b2e-b4f7-6d1d89881b9f'::uuid, 'https://coastcs.nsw.edu.au/apple-icon-57x57.png', 'dead (404)'),
  ('041ea804-e0b9-4e52-9fd4-8f3aabf19944'::uuid, 'https://static.wixstatic.com/media/8b4c4d_2e9a6e1e8d0a4f138e5c7d5e5e5e5e5e~mv2.png', 'invented-looking address; refused (403)'),
  ('1b36ea94-87ef-444b-a80a-c255a7059f5f'::uuid, 'https://www.tanlf.org/images/tanlf-logo.png', 'dead (404)'),
  ('4fcb1118-c875-4fd8-b1ab-17b211776956'::uuid, 'https://www.mentalhealthaustralia.org.au/wp-content/uploads/2020/03/MHA-Logo-Horizontal-300x117.png', 'dead (404)'),
  ('864fb80c-7dcb-41ce-8999-f53e651694a2'::uuid, 'https://www.marysmeals.org.au/wp-content/themes/marysmealsaustralia/assets/images/logo.svg', 'dead (404)'),
  ('509d9e5e-538a-4844-90b8-f40e62b76c6c'::uuid, 'https://icpa.org.au/wp-content/uploads/2021/05/scouts_logo_small_liverpool-resized.png', 'dead (404)'),
  ('240ae748-88a3-4562-a837-9e0f67288bbe'::uuid, 'https://grllen.com.au/wp-content/uploads/2021/04/GRLLEN-Logo-2021.png', 'dead (404)'),
  ('19799143-144a-4f15-b251-0b93e9a0fd8a'::uuid, 'https://cornucopia.org.au/wp-content/uploads/2020/06/cropped-Cornucopia-Logo-1.png', 'dead (404)'),
  ('295799fe-0449-4599-9dfb-565c06e4f6ed'::uuid, 'https://www.hcfoceania.org/wp-content/uploads/2021/08/hcf-logo.png', 'dead (404)'),
  ('331231fa-acb7-4973-a698-7a6ae1b8c656'::uuid, 'https://www.ec.org.au/images/logo.png', 'invented-looking address; dead (404)'),
  ('8b3700ee-8f48-43f4-9dcd-edd7990e1e71'::uuid, 'https://www.reframingautism.org.au/wp-content/uploads/2021/06/Reframing-Autism-Logo-Transparent.png', 'dead (404)'),
  ('09c85629-f9b1-4c8b-883e-af3c0a88d7f1'::uuid, 'http://www.favor611.org/images/logo.png', 'invented-looking address; dead (404)'),
  ('f8f091cb-ca64-4f96-bab6-bbf2bb3646aa'::uuid, 'https://www.believerschurch.com.au/images/logo.png', 'invented-looking address; dead (404)'),
  ('50b1da14-3cde-4f0f-a979-c83403f1f3df'::uuid, 'https://www.murdoch.edu.au/__data/assets/image/0013/144146/logo.png', 'dead (404)')
  ) AS c(id, logo_url, why)
  JOIN organizations o ON o.id = c.id AND o.logo_url = c.logo_url;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM organizations_dead_logos_20260926;
  IF n <> 185 THEN
    RAISE EXCEPTION 'expected 185 dead logo links still in place, found %', n;
  END IF;
END $$;

ALTER TABLE public.organizations_dead_logos_20260926 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations_dead_logos_20260926 FROM anon, authenticated;
GRANT SELECT ON public.organizations_dead_logos_20260926 TO service_role;

UPDATE organizations o
   SET logo_url = NULL
  FROM organizations_dead_logos_20260926 b
 WHERE o.id = b.id
   AND o.logo_url = b.logo_url;

COMMIT;

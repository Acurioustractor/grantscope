-- Clear 126 phone numbers and 44 emails a model put on organisation records that the
-- organisation's own website does not confirm (JusticeHub, 2026-09-26).
--
-- JusticeHub's auto-approve cron applied the website-reading model's suggestions whenever the model
-- rated its own confidence >= 0.95, with no person (paused 2026-09-26, JusticeHub #517). Checked on
-- 2026-09-26 against the text the model read, the live homepage and contact pages, Cloudflare-hidden
-- emails and tel:/mailto: links: of 413 applied phones 255 are on the site; these 126 are not, and
-- for 52 of them the site lists a different number. Of 109 applied emails 50 are on the site; these
-- 44 are all guessed info@-style addresses at the organisation's domain, 34 where the site shows a
-- different address. Phones render as a public "Call" button on /organizations/[slug].
-- Confirmed values, and values on sites that did not load, are NOT touched.
--
-- What this does: copies (id, field, old value, reason) to organizations_unconfirmed_contacts_20260926
-- (service role only), then clears exactly those values, and ONLY where the record still holds the
-- value that was checked. Stops if the count is not exactly 170.
--
-- Asked for by Ben 2026-09-26 ("clear the unconfirmed contacts" / "next").
--
-- Apply AFTER this file is on main:
--   scripts/db-apply.sh supabase/migrations/20260926200000_clear_unconfirmed_org_contacts.sql
-- Undo:
--   UPDATE organizations o SET phone = b.old_value FROM organizations_unconfirmed_contacts_20260926 b
--    WHERE o.id = b.id AND b.field = 'phone' AND o.phone IS NULL;
--   UPDATE organizations o SET contact_email = b.old_value FROM organizations_unconfirmed_contacts_20260926 b
--    WHERE o.id = b.id AND b.field = 'contact_email' AND o.contact_email IS NULL;

BEGIN;
SET LOCAL lock_timeout = '30s';

CREATE TABLE public.organizations_unconfirmed_contacts_20260926 AS
SELECT c.id, c.field, c.old_value, c.why, now() AS cleared_at
  FROM (VALUES
  ('4ff2d9cf-4a45-4611-8582-11f4c617b478'::uuid, 'phone', '+61 7 3040 7420', 'not on the organisation site, which lists a different number'),
  ('898e071a-8877-4e44-8e53-8dc43774f065'::uuid, 'phone', '(02) 4577 3377', 'not on the organisation site, which lists a different number'),
  ('b675f7ae-5660-4ec7-8d6f-98a7397c5104'::uuid, 'phone', '+61 412 521 828', 'not on the organisation site'),
  ('9f6824f4-7170-452a-91c1-9c76ab5fb261'::uuid, 'phone', '1300 792 292', 'not on the organisation site'),
  ('a548315f-7795-4b8b-aa11-36e86a1da3bd'::uuid, 'phone', '+61 3 9265 0200', 'not on the organisation site'),
  ('661a4c65-677f-41ab-959d-cd45fec511dd'::uuid, 'phone', '(07) 3852 6800', 'not on the organisation site'),
  ('f42a6a4d-ef3c-448e-949e-d6bd5ac5ab02'::uuid, 'phone', '(07) 5539 7222', 'not on the organisation site'),
  ('933d5775-ade3-4777-bcde-e2d64b3ec610'::uuid, 'phone', '+61 7 3804 2322', 'not on the organisation site'),
  ('5ff52f51-eeea-4d9f-af29-660e415ffc1a'::uuid, 'phone', '+61 8 8373 2222', 'not on the organisation site, which lists a different number'),
  ('ec98a76d-8964-47f8-8ad8-917ba6a786b5'::uuid, 'phone', '+61 451 995 288', 'not on the organisation site'),
  ('0d8dad4c-8ff8-4575-9289-1132cbf5ed56'::uuid, 'phone', '+61 7 3251 6800', 'not on the organisation site, which lists a different number'),
  ('3c8906fa-f85c-4b4c-a103-5fe67d9fb44a'::uuid, 'phone', '+61 2 9642 2111', 'not on the organisation site, which lists a different number'),
  ('a75afd52-3a3d-4298-9f46-475476cfcf51'::uuid, 'phone', '1300 723 792', 'not on the organisation site'),
  ('221b723e-d894-4c0c-aa8e-59221acc67c2'::uuid, 'phone', '1800 068 527', 'not on the organisation site, which lists a different number'),
  ('b7a549a8-fdc8-4790-ae18-31b39784eb90'::uuid, 'phone', '(07) 4041 7688', 'not on the organisation site'),
  ('84b1d821-e979-42fa-b74d-dec00066f674'::uuid, 'phone', '+61 8 8282 2988', 'not on the organisation site'),
  ('50f3d6cc-445b-4c2b-bb44-0b741a3af402'::uuid, 'phone', '+61 3 9428 7777', 'not on the organisation site'),
  ('8531137f-46b5-4f4c-b420-879bba168851'::uuid, 'phone', '+61 8 8532 9100', 'not on the organisation site'),
  ('98cd6b55-d77c-4f98-9858-3e1cc71b3fbb'::uuid, 'phone', '+61 8 8944 3444', 'not on the organisation site, which lists a different number'),
  ('74470124-7936-4e25-98d6-f2761c0d176b'::uuid, 'phone', '1300 735 336', 'not on the organisation site, which lists a different number'),
  ('e07061f9-3f03-4871-8dfd-64cbe7c661b1'::uuid, 'phone', '(03) 9742 2000', 'not on the organisation site'),
  ('09c85629-f9b1-4c8b-883e-af3c0a88d7f1'::uuid, 'phone', '+61 413 888 611', 'not on the organisation site'),
  ('6c68aa0e-fb54-44a8-9127-69bc93b0e7ca'::uuid, 'phone', '+61 1300 275 278', 'not on the organisation site, which lists a different number'),
  ('8953b8ae-8e81-4a30-b7ab-c759af720f0d'::uuid, 'phone', '+61 7 5509 2900', 'not on the organisation site'),
  ('12dc5727-d559-4369-9085-7243d83dbbab'::uuid, 'phone', '+61 7 4060 7200', 'not on the organisation site'),
  ('3720008c-34fd-4226-962f-6882deb61dfc'::uuid, 'phone', '(03) 5822 4477', 'not on the organisation site, which lists a different number'),
  ('b4e5eb8b-4d89-4c87-b574-92ca7107200c'::uuid, 'phone', '+61 7 4698 6222', 'not on the organisation site'),
  ('7111ce05-7435-4433-a950-3933c9d09e46'::uuid, 'phone', '(07) 3891 2444', 'not on the organisation site'),
  ('e2cdfcb3-6d9a-44ce-8ef4-59165ff63123'::uuid, 'phone', '(07) 4654 1233', 'not on the organisation site, which lists a different number'),
  ('45ec0a52-f7e2-4b49-9275-548eee7f4b47'::uuid, 'phone', '+61 2 8800 2900', 'not on the organisation site'),
  ('c5385ef6-a273-4a9e-a0a0-c5e7475fd910'::uuid, 'phone', '+61 7 5500 5544', 'not on the organisation site'),
  ('9e7553b9-a23c-4e55-ba77-2ff3ac4e7b36'::uuid, 'phone', '+61 7 5500 2300', 'not on the organisation site, which lists a different number'),
  ('b37b5d53-0839-40ee-a057-2bdd80cd56c3'::uuid, 'phone', '+61 7 3824 8300', 'not on the organisation site, which lists a different number'),
  ('5df14efb-eba8-4275-bb7e-ff6ba14649be'::uuid, 'phone', '(03) 5226 0999', 'not on the organisation site, which lists a different number'),
  ('01150cb6-1773-48d1-9575-91e4ffc5c72a'::uuid, 'phone', '+61 7 4099 7303', 'not on the organisation site'),
  ('36b4260d-62de-4ffe-be7d-01cc081c8463'::uuid, 'phone', '(02) 9476 3366', 'not on the organisation site, which lists a different number'),
  ('5161ce61-da2e-4049-9fe8-26359ca8f5d5'::uuid, 'phone', '(07) 3805 2511', 'not on the organisation site, which lists a different number'),
  ('95620499-e8d3-454d-b15f-4a0384434237'::uuid, 'phone', '(07) 3899 6328', 'not on the organisation site, which lists a different number'),
  ('40a1b0be-2faf-406e-8301-f3cb57cad91f'::uuid, 'phone', '(02) 6492 2288', 'not on the organisation site, which lists a different number'),
  ('26a62253-db2d-4325-b107-40a3715e68f3'::uuid, 'phone', '(03) 9730 7400', 'not on the organisation site, which lists a different number'),
  ('dbcbe33b-f32e-46ad-a237-9ac478fd5047'::uuid, 'phone', '+61 8 8952 2222', 'not on the organisation site'),
  ('b1f5a1e7-3709-4591-9078-5d0c093ee4fe'::uuid, 'phone', '(07) 5446 1477', 'not on the organisation site, which lists a different number'),
  ('98630885-289f-4d93-a062-b6e1079f762a'::uuid, 'phone', '(07) 3852 6800', 'not on the organisation site, which lists a different number'),
  ('33ff2d93-b222-4722-a952-97074e10dc5f'::uuid, 'phone', '+61 3 7007 8960', 'not on the organisation site, which lists a different number'),
  ('a8039b74-c55c-4c11-9b2d-23337e2b4c6b'::uuid, 'phone', '(07) 4151 1999', 'not on the organisation site, which lists a different number'),
  ('ff1441eb-f494-4f44-9c79-92353f21781e'::uuid, 'phone', '(02) 6962 1333', 'not on the organisation site, which lists a different number'),
  ('f1bc78d9-315c-4be2-bb55-035d53b90676'::uuid, 'phone', '(02) 9727 9511', 'not on the organisation site, which lists a different number'),
  ('a82d583a-0503-4beb-bfbe-a14ff4919c30'::uuid, 'phone', '(07) 4051 4888', 'not on the organisation site, which lists a different number'),
  ('f7f8842e-c2f3-48f7-98c7-bbe126a5fcb3'::uuid, 'phone', '+61 7 4055 1933', 'not on the organisation site'),
  ('8c1a38a6-9a77-43df-9757-a69b21354fd6'::uuid, 'phone', '1300 364 749', 'not on the organisation site, which lists a different number'),
  ('f8f091cb-ca64-4f96-bab6-bbf2bb3646aa'::uuid, 'phone', '+61 2 9630 2244', 'not on the organisation site'),
  ('582bfd61-7fb9-4911-8c67-836cab86e88d'::uuid, 'phone', '+61 412 793 252', 'not on the organisation site'),
  ('8583e153-0513-47ba-9fda-14bbbe16bd7b'::uuid, 'phone', '+61 3 9568 2241', 'not on the organisation site'),
  ('82498a6c-4d4c-4df0-ac04-34f929767ccc'::uuid, 'phone', '(07) 4121 2448', 'not on the organisation site, which lists a different number'),
  ('295799fe-0449-4599-9dfb-565c06e4f6ed'::uuid, 'phone', '+61 8 8373 3700', 'not on the organisation site'),
  ('ca04e3bd-ca3d-4ac2-92d6-a7d0424cda4b'::uuid, 'phone', '(07) 3204 7800', 'not on the organisation site, which lists a different number'),
  ('f153f64b-0567-4226-8469-25f5ae4ed90a'::uuid, 'phone', '+61 3 9500 4188', 'not on the organisation site, which lists a different number'),
  ('864fb80c-7dcb-41ce-8999-f53e651694a2'::uuid, 'phone', '+61 2 8041 5400', 'not on the organisation site'),
  ('fa16de35-1d53-463e-b56c-104fb0d50183'::uuid, 'phone', '+61 8 9336 2225', 'not on the organisation site, which lists a different number'),
  ('0655fe97-84dc-4066-ad44-79443a0b0585'::uuid, 'phone', '+61 7 3378 0888', 'not on the organisation site'),
  ('5ef4fe82-a7f5-4dc1-808a-ac515ded2141'::uuid, 'phone', '(02) 9671 5555', 'not on the organisation site'),
  ('015692f3-0c47-462a-8251-d9ac1ad9def3'::uuid, 'phone', '1300 136 588', 'not on the organisation site'),
  ('041ea804-e0b9-4e52-9fd4-8f3aabf19944'::uuid, 'phone', '(07) 3349 7442', 'not on the organisation site'),
  ('cee252fa-3ecd-466f-9ce1-1bfc97e9de03'::uuid, 'phone', '+61 3 9479 1500', 'not on the organisation site'),
  ('9502abaa-d986-4761-bfa0-8783f7eb7739'::uuid, 'phone', '1800 042 138', 'not on the organisation site, which lists a different number'),
  ('331231fa-acb7-4973-a698-7a6ae1b8c656'::uuid, 'phone', '+61 7 3712 2700', 'not on the organisation site'),
  ('1c6ccbab-1df6-4f01-8343-bdf3f776b859'::uuid, 'phone', '(07) 4952 2944', 'not on the organisation site, which lists a different number'),
  ('0385c981-d5ac-4421-a4fa-e1010e9de8bb'::uuid, 'phone', '+61 7 5445 2343', 'not on the organisation site'),
  ('1a382e6a-d34b-4cf1-ac41-3276940bf4c3'::uuid, 'phone', '+61 3 9369 1900', 'not on the organisation site'),
  ('47299f9a-da81-4238-bdc7-8c827a88a3c4'::uuid, 'phone', '+61 3 9800 8888', 'not on the organisation site'),
  ('f5602569-4cbe-46c9-aac0-7bfc8498e28c'::uuid, 'phone', '+61 3 9654 3100', 'not on the organisation site, which lists a different number'),
  ('f95290e4-02bf-4b1c-99ca-edfbffb3b7ca'::uuid, 'phone', '+61 7 5544 7500', 'not on the organisation site, which lists a different number'),
  ('7f9a4955-483a-4987-a6c3-32588b6ddb34'::uuid, 'phone', '+61 7 3870 7777', 'not on the organisation site, which lists a different number'),
  ('cbd9796a-25a5-43fc-9427-1017b98b62d1'::uuid, 'phone', '+61 2 9390 2100', 'not on the organisation site'),
  ('932dbdcd-bcbd-4a42-af61-3093d3a16858'::uuid, 'phone', '+61 412 525 377', 'not on the organisation site'),
  ('38a0ddb9-b6f8-495b-9329-afcd9db01490'::uuid, 'phone', '+61 3 5226 3222', 'not on the organisation site, which lists a different number'),
  ('ebaa1a4d-ca10-48b9-9aa9-29fac505d9d5'::uuid, 'phone', '+61 7 3844 2255', 'not on the organisation site'),
  ('4cc1fb92-576b-437b-8351-1926d14b9995'::uuid, 'phone', '+61 7 3257 6888', 'not on the organisation site, which lists a different number'),
  ('819f2895-efa0-48a4-874e-f4603316b2ac'::uuid, 'phone', '+61 3 6234 0888', 'not on the organisation site, which lists a different number'),
  ('cb7be846-0ff1-45d5-89ca-87fb7ae3a943'::uuid, 'phone', '+61 3 5755 1988', 'not on the organisation site'),
  ('99382333-9cf5-471c-81c2-6363450ef4eb'::uuid, 'phone', '+61 2 9520 3222', 'not on the organisation site'),
  ('d94e6f16-fd24-4e04-a7f3-31c75ce05f75'::uuid, 'phone', '(02) 4228 1388', 'not on the organisation site'),
  ('511ced3d-131d-4af2-a8a1-d770ca12de00'::uuid, 'phone', '+61 2 4721 1929', 'not on the organisation site'),
  ('47304dbc-b55c-4ca0-ad0b-a39e50799e9d'::uuid, 'phone', '(02) 9716 3322', 'not on the organisation site'),
  ('d938eb28-2af5-4aaa-972f-f9cbefe81692'::uuid, 'phone', '+61 7 5509 2333', 'not on the organisation site'),
  ('bb112eec-3b4e-4a27-9ee8-da386eb10ccc'::uuid, 'phone', '(02) 6362 1666', 'not on the organisation site'),
  ('386147a8-b555-421b-ae13-d64b4da6ebeb'::uuid, 'phone', '+61 2 9646 2666', 'not on the organisation site'),
  ('7f0927f2-277a-4124-b84a-279f868bc4ed'::uuid, 'phone', '+61 3 9580 3222', 'not on the organisation site, which lists a different number'),
  ('ba8e4ad1-5cfa-400b-8107-f20ab14a0b3d'::uuid, 'phone', '(02) 6772 2225', 'not on the organisation site, which lists a different number'),
  ('c05ce89f-ab47-4a4b-a0d8-5c87b2bc7539'::uuid, 'phone', '1300 RivGift', 'not on the organisation site'),
  ('907ef5ab-f744-44e9-8d60-2e852cf3f058'::uuid, 'phone', '1300 116 922', 'not on the organisation site, which lists a different number'),
  ('da88f574-be5a-406f-a6c0-bb25718b6d2a'::uuid, 'phone', '(07) 4051 4888', 'not on the organisation site'),
  ('353cb3ef-9454-4656-b7f9-88998c59ead4'::uuid, 'phone', '+61 8 8952 4800', 'not on the organisation site'),
  ('f5f2ece1-0fc5-4643-8c0b-bff64618752b'::uuid, 'phone', '13 18 19', 'not on the organisation site'),
  ('f2159e0a-253e-4b84-94a4-fbe9d4b6e78a'::uuid, 'phone', '+61 7 5482 1229', 'not on the organisation site, which lists a different number'),
  ('1f462297-6358-475b-afe7-90770a39d665'::uuid, 'phone', '(02) 4732 5300', 'not on the organisation site'),
  ('6d4208aa-d74a-4c5e-8f63-4e5e974a3c1f'::uuid, 'phone', '+61 2 9852 5222', 'not on the organisation site, which lists a different number'),
  ('31c7cee1-a7bd-44a3-b05e-4d15030a05d0'::uuid, 'phone', '+61 2 6125 2333', 'not on the organisation site'),
  ('d7314236-0b0f-4f6a-b275-996e853902d9'::uuid, 'phone', '(07) 4671 1208', 'not on the organisation site'),
  ('a44a1aac-c680-4130-8873-f9275e15b2b1'::uuid, 'phone', '(07) 4162 7400', 'not on the organisation site, which lists a different number'),
  ('533d3519-5efa-42fc-81f5-0667585fd58d'::uuid, 'phone', '+61 8 9175 7777', 'not on the organisation site, which lists a different number'),
  ('4c572f19-35b6-4457-8fc4-5253c077e3c3'::uuid, 'phone', '+61 2 6251 1764', 'not on the organisation site'),
  ('0ce96ca9-60fd-4c15-9cbf-3934d297bc7e'::uuid, 'phone', '(02) 9633 2600', 'not on the organisation site'),
  ('c27f3cef-bf02-428e-a662-e0ea8d9b7290'::uuid, 'phone', '+61 7 4564 0700', 'not on the organisation site'),
  ('8b38c6f8-d1da-4acf-99fe-11f9f3c7753c'::uuid, 'phone', '1300 782 682', 'not on the organisation site, which lists a different number'),
  ('e831d528-dae7-4be7-8570-c8459677f282'::uuid, 'phone', '+61 3 9419 3421', 'not on the organisation site'),
  ('49a19217-167d-4a0b-acf9-38e66f35e301'::uuid, 'phone', '(03) 9763 3366', 'not on the organisation site'),
  ('e7ea70e3-c5a4-4614-abe5-e62bed10928f'::uuid, 'phone', '02 9241 1510', 'not on the organisation site'),
  ('f0853fa6-8436-4159-868e-f3f2a32714f4'::uuid, 'phone', '(02) 6331 2111', 'not on the organisation site, which lists a different number'),
  ('5102368c-dd81-42fd-9e20-e1159375997d'::uuid, 'phone', '+61 3 9700 1234', 'not on the organisation site'),
  ('240ae748-88a3-4562-a837-9e0f67288bbe'::uuid, 'phone', '(03) 5226 5586', 'not on the organisation site'),
  ('5f5793bf-9d65-4630-8ce4-af998b1b0a67'::uuid, 'phone', '+61 407 483 999', 'not on the organisation site'),
  ('4fcb1118-c875-4fd8-b1ab-17b211776956'::uuid, 'phone', '(02) 6285 3300', 'not on the organisation site'),
  ('e52dcc45-0e79-42a2-b056-f0e872427060'::uuid, 'phone', '+61 2 6021 3388', 'not on the organisation site'),
  ('6bfe93d5-812b-4cc0-945d-f5b54ff47fc7'::uuid, 'phone', '+61 2 9845 1444', 'not on the organisation site'),
  ('8273166c-e8a9-46dd-abcb-19dac656d17d'::uuid, 'phone', '+61 2 4603 1233', 'not on the organisation site, which lists a different number'),
  ('7977e546-47ff-4503-972d-132692913493'::uuid, 'phone', '(02) 9689 1888', 'not on the organisation site, which lists a different number'),
  ('19799143-144a-4f15-b251-0b93e9a0fd8a'::uuid, 'phone', '(02) 9555 8174', 'not on the organisation site'),
  ('017d352d-7542-4d6f-977e-e866083cebd9'::uuid, 'phone', '(07) 5500 7500', 'not on the organisation site'),
  ('00daa68d-d5c1-4db9-8810-d316405fe041'::uuid, 'phone', '+61 7 3891 3377', 'not on the organisation site'),
  ('fe9b1659-148d-4a7e-9b7a-0692abffa874'::uuid, 'phone', '+61 7 3409 4488', 'not on the organisation site'),
  ('3426dd96-2a04-4738-970a-e6e5742cab48'::uuid, 'phone', '0403 000 000', 'not on the organisation site'),
  ('13015189-9fa5-4553-99ba-c36a1787ecb0'::uuid, 'phone', '+61 7 3822 2399', 'not on the organisation site'),
  ('edd62462-115e-4c36-86e6-18665bfb2a5c'::uuid, 'phone', '(02) 4368 4248', 'not on the organisation site'),
  ('307780e0-54ad-42ea-bf69-adb1724acfca'::uuid, 'phone', '(07) 3727 6333', 'not on the organisation site'),
  ('2d0c6c3e-fe30-4c81-8057-db363156bb3d'::uuid, 'phone', '+61 7 5544 5600', 'not on the organisation site'),
  ('898e071a-8877-4e44-8e53-8dc43774f065'::uuid, 'contact_email', 'admin@strongnation.community', 'guessed info@-style address; the site shows a different email'),
  ('532da52a-7542-406a-875d-b50660c1c0a7'::uuid, 'contact_email', 'info@primaryethics.com.au', 'guessed info@-style address; the site shows a different email'),
  ('a11ab2eb-e9b4-43fc-9e20-dbcc301bfcdd'::uuid, 'contact_email', 'info@beaucare.org.au', 'guessed info@-style address; the site shows a different email'),
  ('2dffb111-65d9-4bb9-bdc1-04c55c8f6286'::uuid, 'contact_email', 'info@nacys.asn.au', 'guessed info@-style address; the site shows a different email'),
  ('70615d03-9283-41fb-8536-301a02de1b15'::uuid, 'contact_email', 'info@gladstonewomenshealth.org.au', 'guessed info@-style address; the site shows a different email'),
  ('6c68aa0e-fb54-44a8-9127-69bc93b0e7ca'::uuid, 'contact_email', 'info@cqu.edu.au', 'guessed info@-style address; the site shows a different email'),
  ('12dc5727-d559-4369-9085-7243d83dbbab'::uuid, 'contact_email', 'info@gulfsavannahdevelopment.com.au', 'guessed info@-style address; the site shows a different email'),
  ('3720008c-34fd-4226-962f-6882deb61dfc'::uuid, 'contact_email', 'info@sheppaccess.com.au', 'guessed info@-style address; the site shows a different email'),
  ('b4e5eb8b-4d89-4c87-b574-92ca7107200c'::uuid, 'contact_email', 'info@highlands.qld.edu.au', 'guessed info@-style address; the site shows a different email'),
  ('0128baf1-a611-4b2e-b4f7-6d1d89881b9f'::uuid, 'contact_email', 'office@coastcs.nsw.edu.au', 'guessed info@-style address, not on the site'),
  ('a542d117-95c9-4f31-8352-ceb64b6f88d1'::uuid, 'contact_email', 'info@menopause.org.au', 'guessed info@-style address; the site shows a different email'),
  ('b37b5d53-0839-40ee-a057-2bdd80cd56c3'::uuid, 'contact_email', 'info@redlandscoastmuseum.org.au', 'guessed info@-style address; the site shows a different email'),
  ('827d8a48-334d-4080-b835-e8fd6300a1c2'::uuid, 'contact_email', 'info@someonewhocares.net.au', 'guessed info@-style address; the site shows a different email'),
  ('ee0d0fe3-b643-4d6d-b1e4-168adddb87fd'::uuid, 'contact_email', 'info@humehousing.com.au', 'guessed info@-style address; the site shows a different email'),
  ('b42b06e6-6b01-4233-ab58-3ecff80acca2'::uuid, 'contact_email', 'info@qmhs.com.au', 'guessed info@-style address; the site shows a different email'),
  ('95620499-e8d3-454d-b15f-4a0384434237'::uuid, 'contact_email', 'admin@ebcc.com.au', 'guessed info@-style address; the site shows a different email'),
  ('40a1b0be-2faf-406e-8301-f3cb57cad91f'::uuid, 'contact_email', 'info@southernwomensgroup.org.au', 'guessed info@-style address; the site shows a different email'),
  ('26a62253-db2d-4325-b107-40a3715e68f3'::uuid, 'contact_email', 'info@cire.org.au', 'guessed info@-style address, not on the site'),
  ('dbcbe33b-f32e-46ad-a237-9ac478fd5047'::uuid, 'contact_email', 'enquiries@yirara.nt.edu.au', 'guessed info@-style address, not on the site'),
  ('ff1441eb-f494-4f44-9c79-92353f21781e'::uuid, 'contact_email', 'info@lcn.org.au', 'guessed info@-style address; the site shows a different email'),
  ('f1bc78d9-315c-4be2-bb55-035d53b90676'::uuid, 'contact_email', 'admin@bwhc.org.au', 'guessed info@-style address; the site shows a different email'),
  ('ca04e3bd-ca3d-4ac2-92d6-a7d0424cda4b'::uuid, 'contact_email', 'info@genesis.qld.edu.au', 'guessed info@-style address; the site shows a different email'),
  ('c4c9c49f-b48a-4234-a3cc-7ce4a223ab34'::uuid, 'contact_email', 'info@littleheroesfoundation.com.au', 'guessed info@-style address, not on the site'),
  ('f0fe72fa-354b-45b3-a02c-cdac0c0ddb77'::uuid, 'contact_email', 'info@dementia.org.au', 'guessed info@-style address; the site shows a different email'),
  ('1c6ccbab-1df6-4f01-8343-bdf3f776b859'::uuid, 'contact_email', 'info@ksn.org.au', 'guessed info@-style address; the site shows a different email'),
  ('0508bc7e-96a1-44f9-b970-ac40d4eeed69'::uuid, 'contact_email', 'info@ilrms.com.au', 'guessed info@-style address; the site shows a different email'),
  ('ebaa1a4d-ca10-48b9-9aa9-29fac505d9d5'::uuid, 'contact_email', 'info@emmanuelcitymission.com', 'guessed info@-style address, not on the site'),
  ('99382333-9cf5-471c-81c2-6363450ef4eb'::uuid, 'contact_email', 'info@projectyouth.org.au', 'guessed info@-style address; the site shows a different email'),
  ('df03a3ce-ffb8-44fd-88b5-3026388fa035'::uuid, 'contact_email', 'info@bluesky.org.au', 'guessed info@-style address; the site shows a different email'),
  ('984be243-3749-43e3-8ea5-8e7d7c6ddfa9'::uuid, 'contact_email', 'info@rna.org.au', 'guessed info@-style address; the site shows a different email'),
  ('d938eb28-2af5-4aaa-972f-f9cbefe81692'::uuid, 'contact_email', 'info@yalari.org', 'guessed info@-style address, not on the site'),
  ('d961333a-69ca-47f8-945d-f703a5060d34'::uuid, 'contact_email', 'info@birdlife.org.au', 'guessed info@-style address; the site shows a different email'),
  ('bb112eec-3b4e-4a27-9ee8-da386eb10ccc'::uuid, 'contact_email', 'info@odeep.com.au', 'guessed info@-style address; the site shows a different email'),
  ('1f462297-6358-475b-afe7-90770a39d665'::uuid, 'contact_email', 'info@westcare.org.au', 'guessed info@-style address; the site shows a different email'),
  ('f69f8d23-0e6f-45e6-8291-63c03dec7096'::uuid, 'contact_email', 'info@baptistcaresafoundation.org.au', 'guessed info@-style address, not on the site'),
  ('38b58cea-cec0-4c7b-bb85-f176b2359071'::uuid, 'contact_email', 'info@hamptonrsl.com.au', 'guessed info@-style address; the site shows a different email'),
  ('f0853fa6-8436-4159-868e-f3f2a32714f4'::uuid, 'contact_email', 'info@mitchellconservatorium.edu.au', 'guessed info@-style address; the site shows a different email'),
  ('eec70a09-c99d-4dbd-8f4c-9d30d96c9147'::uuid, 'contact_email', 'info@uncommodify.org', 'guessed info@-style address, not on the site'),
  ('0079a23c-3177-42d1-a165-90022cfc897a'::uuid, 'contact_email', 'info@harkangel.org', 'guessed info@-style address, not on the site'),
  ('42a47a18-83b5-4b27-b0f5-a39eb7ba36d1'::uuid, 'contact_email', 'info@rasa.org.au', 'guessed info@-style address; the site shows a different email'),
  ('017d352d-7542-4d6f-977e-e866083cebd9'::uuid, 'contact_email', 'info@kalwun.com.au', 'guessed info@-style address; the site shows a different email'),
  ('f8f827bf-bec8-4d18-a717-00069be8d355'::uuid, 'contact_email', 'enquiries@braillehouse.org.au', 'guessed info@-style address; the site shows a different email'),
  ('edd62462-115e-4c36-86e6-18665bfb2a5c'::uuid, 'contact_email', 'admin@boltonpointchildcare.com.au', 'guessed info@-style address; the site shows a different email'),
  ('f2f280d4-020c-4ad2-a8ec-74ad2211c767'::uuid, 'contact_email', 'admin@playfordtrust.com.au', 'guessed info@-style address, not on the site')
  ) AS c(id, field, old_value, why)
  JOIN organizations o ON o.id = c.id
   AND ((c.field = 'phone' AND o.phone = c.old_value)
     OR (c.field = 'contact_email' AND lower(o.contact_email) = lower(c.old_value)));

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM organizations_unconfirmed_contacts_20260926;
  IF n <> 170 THEN
    RAISE EXCEPTION 'expected 170 unconfirmed contact values still in place, found %', n;
  END IF;
END $$;

ALTER TABLE public.organizations_unconfirmed_contacts_20260926 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organizations_unconfirmed_contacts_20260926 FROM anon, authenticated;
GRANT SELECT ON public.organizations_unconfirmed_contacts_20260926 TO service_role;

UPDATE organizations o SET phone = NULL
  FROM organizations_unconfirmed_contacts_20260926 b
 WHERE o.id = b.id AND b.field = 'phone' AND o.phone = b.old_value;

UPDATE organizations o SET contact_email = NULL
  FROM organizations_unconfirmed_contacts_20260926 b
 WHERE o.id = b.id AND b.field = 'contact_email' AND lower(o.contact_email) = lower(b.old_value);

COMMIT;

-- Telethon FY2024 grantee ingest — from the Channel 7 Telethon Trust's own
-- "Grants and Fellowships Awarded 2024" register (telethon7.com, linked from the 2025
-- impact report). 160 grantee rows totalling $100,613,729 (register's printed total
-- $100,613,726 — $3 rounding variance in the source document itself).
-- 115 of 160 resolved to graph entities (37 exact-name, 58 WA-fuzzy accepted, 20 national
-- second-pass hand-adjudicated). Amounts include multi-year commitments per the register's
-- own footnotes. REVERSIBLE by dataset='telethon_grants_2024':
--   DELETE FROM gs_relationships WHERE dataset='telethon_grants_2024';
-- 45 HELD OUT unresolved (no confident graph entity; ingest when resolved):
--   WA Child Research Fund (10,000,000)
--   Teach Speak Hear / TSH (3,300,750)
--   Ability WA (1,554,742)
--   Joondalup Health Campus (1,300,000)
--   Earbus Foundation of WA (1,154,233)
--   Down Syndrome WA (891,386)
--   Kiind (600,000)
--   YouthCARE (500,281)
--   Cockburn Integrated Health (472,000)
--   Outcare (412,243)
--   Communicare (400,000)
--   OzHarvest (389,393)
--   SensesWA (290,553)
--   Wheels for Hope (275,000)
--   Lifeline WA (270,387)
--   A Stitch In Time (261,079)
--   Cystic Fibrosis WA (238,849)
--   Luma for her Health and Wellbeing (184,958)
--   The Fathering Project (175,000)
--   Epilepsy WA (166,292)
--   ADHD WA (160,420)
--   Wanslea (157,975)
--   Nature Play WA (157,790)
--   Legacy WA (137,225)
--   Holyoake (135,624)
--   HorsePower Hills (133,947)
--   The LBW Trust (125,000)
--   Cahoots (122,686)
--   EdConnect Australia (120,250)
--   Expression Australia (120,000)
--   The Humour Foundation (114,949)
--   Riding for the Disabled Carine (103,590)
--   Binar Futures (100,000)
--   JK Foundation (100,000)
--   Supertee (93,878)
--   Helping Minds (91,000)
--   Variety - the Children’s Charity of WA (62,261)
--   Kidney Health Australia (60,750)
--   Barking Gecko Arts (53,500)
--   Raise Foundation (50,000)
--   Special Olympics WA (50,000)
--   Helping Little Hands (45,000)
--   Karratha Community House (32,391)
--   Riding for the Disabled BrookValley Farm (20,000)
--   Carers Association of Western Australia Inc. (19,984)
-- Apply: source .env && PGPASSWORD="$DATABASE_PASSWORD" psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -f migrations/2026-08-17-telethon-grantees-ingest.sql
BEGIN;
WITH rows_(grantee_gs_id, amount, confidence) AS (VALUES
 ('AU-ABN-37180581224',14213054,'inferred'),  -- Perth Children’s Hospital (Child and Adolescent Health Service) [fuzzy]
 ('AU-ABN-35563430804',11372941,'inferred'),  -- Youth Focus [fuzzy]
 ('AU-ABN-86009278755',5419791,'reported'),  -- The Kids Research Institute Australia [exact]
 ('AU-ABN-61282636952',3639328,'reported'),  -- North Metropolitan Health Service [exact]
 ('AU-ABN-32797454970',2530159,'reported'),  -- Anglicare WA [exact]
 ('AU-ABN-80931522157',2081739,'reported'),  -- Starlight Children's Foundation Australia [exact]
 ('AU-ABN-57057873242',1981495,'inferred'),  -- Respiratory Care WA [fuzzy]
 ('AU-ABN-48106521439',1690842,'inferred'),  -- Lions Eye Institute [fuzzy]
 ('AU-ABN-60824221416',1410823,'reported'),  -- Derbarl Yerrigan Health Service Aboriginal Corporation [exact]
 ('AU-ABN-86437092401',1322561,'inferred'),  -- Parkerville Children and Youth Care Inc. [pass2]
 ('AU-LOBBY-lzeasq',1315232,'reported'),  -- St John of God Foundation [exact]
 ('AU-ABN-37882817280',1231651,'reported'),  -- University of Western Australia [exact]
 ('AU-ABN-54659775907',1135370,'inferred'),  -- Pregnancy to Parenthood Clinic [fuzzy]
 ('AU-ABN-61616369313',1095902,'reported'),  -- Murdoch University [exact]
 ('AU-ABN-49134881272',1000000,'inferred'),  -- Puntukurnu Aboriginal Medical Service [fuzzy]
 ('AU-ABN-78525401907',1000000,'reported'),  -- Julyardi Aboriginal Corporation [exact]
 ('AU-ABN-86348683935',892200,'reported'),  -- Hannah's House [exact]
 ('AU-ABN-99143842569',872976,'reported'),  -- Curtin University [exact]
 ('AU-ABN-11101785219',869707,'inferred'),  -- The Australian Children's Music Foundation [pass2]
 ('AU-ABN-49363114556',851232,'inferred'),  -- Foodbank Western Australia [fuzzy]
 ('AU-ABN-18604862071',817000,'inferred'),  -- Perth Children's Hospital Foundation [fuzzy]
 ('AU-ABN-29067077696',750000,'inferred'),  -- Royal Flying Doctor Service Western Operations [fuzzy]
 ('AU-ABN-34026572373',713266,'inferred'),  -- Kids are Kids Therapy & Education Centre Inc [fuzzy]
 ('AU-ABN-66028387386',656073,'inferred'),  -- Rocky Bay Ltd [pass2]
 ('AU-ABN-94418431354',651654,'reported'),  -- Women and Infants Research Foundation Limited [exact]
 ('AU-ABN-56164667098',606318,'reported'),  -- Thriving Exercise Rehabilitation Inc. [exact]
 ('AU-ABN-92264056442',572561,'inferred'),  -- Fiona Stanley Hospital, South Metropolitan Health Service [fuzzy]
 ('AU-ABN-67349266332',522610,'inferred'),  -- Fair Game Australia [fuzzy]
 ('AU-ABN-54354917843',504982,'inferred'),  -- Autism Association of Western Australia [fuzzy]
 ('AU-ABN-99070870398',491882,'inferred'),  -- Perron Institute for Neurological and Translational Science [fuzzy]
 ('AU-ABN-64621590101',459761,'inferred'),  -- Rebound WA [fuzzy]
 ('AU-ABN-90634932564',456435,'inferred'),  -- WA All Abilities Football Association [pass2]
 ('AU-ABN-30875218471',449951,'inferred'),  -- 12 Buckets Inc [fuzzy]
 ('AU-ABN-38486033460',411016,'reported'),  -- Lionheart Camp for Kids Incorporated [exact]
 ('AU-ABN-22157739734',396424,'inferred'),  -- Type 1 Diabetes Family Centre [fuzzy]
 ('AU-ABN-82614438658',386309,'inferred'),  -- Far North Community Services [fuzzy]
 ('AU-ABN-67796715775',377129,'inferred'),  -- Therapy Focus [fuzzy]
 ('AU-ABN-65164622459',355000,'inferred'),  -- Schools Plus [pass2]
 ('AU-ABN-22613854336',345171,'inferred'),  -- HeartKids [pass2]
 ('AU-ABN-29964779934',329670,'inferred'),  -- zero2hero [fuzzy]
 ('AU-ABN-37062573814',322640,'inferred'),  -- WA Disabled Sports Association Inc. [fuzzy]
 ('AU-ABN-74118106856',307320,'inferred'),  -- Neurological Council of WA [fuzzy]
 ('AU-ABN-19612097864',300000,'inferred'),  -- ABC Foundation [fuzzy]
 ('AU-ABN-46332941157',294496,'inferred'),  -- Thriive [fuzzy]
 ('AU-ABN-97006497632',283962,'inferred'),  -- Make-A-Wish Australia [pass2]
 ('AU-ABN-68784870577',273850,'reported'),  -- Kids Cancer Support Group Incorporated [exact]
 ('AU-ABN-56721993085',269657,'inferred'),  -- Starick Services [fuzzy]
 ('AU-ABN-53046843443',267340,'reported'),  -- Reclink Australia [exact]
 ('AU-ABN-234126186',260800,'reported'),  -- The Salvation Army [exact]
 ('AU-ABN-87052097720',243910,'inferred'),  -- Camp Quality [pass2]
 ('AU-ABN-65104710787',242550,'reported'),  -- Redkite [exact]
 ('AU-ABN-48804903003',211997,'reported'),  -- Ear Science Institute Australia Incorporated [exact]
 ('AU-ABN-27626364814',210397,'inferred'),  -- Allergy Support Hub [fuzzy]
 ('AU-ABN-36613611313',205650,'inferred'),  -- Ocean Heroes [fuzzy]
 ('AU-ABN-16823190402',193529,'inferred'),  -- Harry Perkins Institute of Medical Research [fuzzy]
 ('AU-ABN-61645924474',190590,'inferred'),  -- Football Futures Foundation [fuzzy]
 ('AU-ABN-36529149329',187277,'inferred'),  -- Edmund Rice Centre WA [fuzzy]
 ('AU-ABN-93095168773',180000,'reported'),  -- Sports Challenge Australia [exact]
 ('AU-ABN-30292419949',175604,'reported'),  -- Sensorium Theatre Incorporated [exact]
 ('AU-ABN-71147859185',172243,'inferred'),  -- White Zebra Foundation [fuzzy]
 ('AU-ABN-64806247447',158700,'inferred'),  -- Ability Solutions [fuzzy]
 ('AU-ABN-73737467358',150820,'inferred'),  -- Youth Disability Advocacy Network [pass2]
 ('AU-ABN-37348710488',150045,'reported'),  -- Superfins WA Incorporated [exact]
 ('AU-ABN-98471684552',150000,'reported'),  -- Sony Foundation Australia [exact]
 ('AU-ABN-68008621252',149840,'reported'),  -- Blind Sports Australia [exact]
 ('AU-ABN-23627009545',147952,'reported'),  -- Swan Districts Foundation Ltd [exact]
 ('AU-ABN-98682346274',143500,'inferred'),  -- WA Cricket Foundation [fuzzy]
 ('AU-ABN-30018685040',136295,'reported'),  -- EON Aboriginal Corporation [exact]
 ('AU-ABN-65993189366',131658,'inferred'),  -- Fiona Wood Foundation [fuzzy]
 ('AU-ABN-52766280589',126936,'inferred'),  -- Meningitis Centre Australia [fuzzy]
 ('AU-ABN-89132323347',125358,'reported'),  -- Food Ladder [exact]
 ('AU-ABN-28000030179',122514,'reported'),  -- The Smith Family [exact]
 ('AU-ABN-61714931846',120000,'inferred'),  -- All Stars for Autism [fuzzy]
 ('AU-ABN-38262080944',117765,'reported'),  -- Spectrum Space Inc. [exact]
 ('AU-ABN-66601770932',116555,'inferred'),  -- Perth Symphony Orchestra [fuzzy]
 ('AU-ABN-93799121312',115042,'inferred'),  -- Bridge Builders [pass2]
 ('AU-ABN-35991526755',110466,'reported'),  -- Kwinana Early Years Services [exact]
 ('AU-ABN-14137434596',107938,'reported'),  -- Miracle Babies Foundation Ltd [exact]
 ('AU-ABN-62464700830',100000,'inferred'),  -- Dandelions WA [fuzzy]
 ('AU-ABN-35436061290',95948,'inferred'),  -- Blackwood Youth Action [fuzzy]
 ('AU-ABN-75995767279',95645,'inferred'),  -- Furthering Autistic Children's Education and Schooling (FACES) [pass2]
 ('AU-ABN-50149270900',93600,'inferred'),  -- The Magic Coat Foundation [fuzzy]
 ('AU-ABN-94160383406',91500,'reported'),  -- Bully Zero Australia Foundation [exact]
 ('AU-ABN-52609589022',89576,'inferred'),  -- Eat Up Australia [pass2]
 ('AU-ABN-28680145816',87344,'inferred'),  -- WA Country Health Service - Mental Health [fuzzy]
 ('AU-ABN-18055440232',86000,'inferred'),  -- Radio Lollipop [pass2]
 ('AU-ABN-12614172173',82478,'inferred'),  -- Australian Kookaburra Kids Foundation [pass2]
 ('AU-ABN-55028468715',79768,'inferred'),  -- St John Ambulance Western Australia [fuzzy]
 ('AU-ABN-15190821561',79200,'inferred'),  -- Cancer Council of Western Australia [fuzzy]
 ('AU-ABN-83610169072',70750,'inferred'),  -- Inclusion Solutions [fuzzy]
 ('AU-ABN-32626833832',68214,'inferred'),  -- Little Big Steps [pass2]
 ('AU-ABN-11609851283',67840,'inferred'),  -- Glass Jar Australia [fuzzy]
 ('AU-ABN-42118872438',61250,'reported'),  -- Eq Cetera Inc [exact]
 ('AU-ABN-74820194498',60696,'inferred'),  -- WA Mums Cottage [pass2]
 ('AU-ABN-49158959834',58947,'inferred'),  -- Neuromuscular WA [fuzzy]
 ('AU-ABN-29531234097',56925,'inferred'),  -- Achievers Club WA Inc. [fuzzy]
 ('AU-ABN-98168910316',54213,'inferred'),  -- Pelvic Pain Foundation of Australia [pass2]
 ('AU-ABN-39077025811',51675,'inferred'),  -- The Katina Woodruff Children's Foundation Inc. [fuzzy]
 ('AU-ABN-65968639541',51107,'inferred'),  -- Riding for the Disabled Capricorn [fuzzy]
 ('AU-ABN-12129500125',50030,'reported'),  -- Ngala Family Services [exact]
 ('AU-ABN-64399865631',49795,'inferred'),  -- Constable Care Child Safety Foundation Inc. [fuzzy]
 ('AU-ABN-39107428615',44664,'inferred'),  -- Transplant Australia [pass2]
 ('AU-ABN-55009292700',38742,'reported'),  -- Scitech Discovery Centre [exact]
 ('AU-ABN-98588691952',37000,'inferred'),  -- Camp Autism WA [fuzzy]
 ('AU-ABN-11274679098',34500,'inferred'),  -- Uni Camp for Kids Inc [pass2]
 ('AU-ABN-83166760514',30105,'reported'),  -- Tiny Sparks WA Inc [exact]
 ('AU-ABN-65437076112',30000,'inferred'),  -- Life Education WA [fuzzy]
 ('AU-ABN-61875542330',28133,'inferred'),  -- The Healthy Strides Foundation [fuzzy]
 ('AU-ABN-84642096053',26500,'inferred'),  -- Childhood Dementia Initiative [pass2]
 ('AU-ABN-85937033873',25085,'inferred'),  -- Western Australian Assistance and Therapy Dogs [fuzzy]
 ('AU-ABN-72481700415',22350,'inferred'),  -- Fostering Hope Australia inc. [fuzzy]
 ('AU-ABN-57753954685',20019,'inferred'),  -- Para and Ability Dance WA [fuzzy]
 ('AU-ABN-46884461809',13948,'inferred'),  -- Riding for the Disabled Brigadoon [fuzzy]
 ('AU-ABN-98367590237',10000,'inferred'),  -- Operation Sunshine [fuzzy]
 ('AU-ABN-13138297938',9405,'reported')  -- The Lung Warrior Incorporated [exact]
)
INSERT INTO gs_relationships (source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_url, confidence)
SELECT s.id, t.id, 'grant', r.amount, 2024, 'telethon_grants_2024',
       'https://www.telethon7.com/wp-content/uploads/The-Channel-7-Telethon-Trust_2024_Financial-Awarded-Report.pdf',
       r.confidence
FROM rows_ r
JOIN gs_entities s ON s.gs_id = 'AU-ABN-65069482829'
JOIN gs_entities t ON t.gs_id = r.grantee_gs_id;
COMMIT;

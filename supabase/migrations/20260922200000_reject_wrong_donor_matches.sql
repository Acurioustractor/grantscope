-- Reject 187 donor→ABN matches that name a different organisation.
--
-- donor_entity_matches decides who every ABN-less political donation is attributed to in the
-- graph (scripts/lib/graph-edge-datasets.mjs donor_map). None of its 10,269 rows had ever been
-- checked. scripts/jev-donor-plausibility.mjs asked Jev, per distinct (donor name, ABN) pair,
-- whether the donor is the organisation the ABN register holds under that ABN. These 187 pairs
-- came back "different" at confidence >= 0.90 ($8.46M of total_donated), e.g.
-- Rio Tinto Limited -> MUCHO LOCOS PTY LTD, Pershing Securities -> FINCLEAR SERVICES.
-- Report: thoughts/shared/findings/jev-donor-plausibility-2026-09-22.md. Approved by Ben 2026-09-22.
--
-- The ABN is CLEARED, the row is kept. scripts/resolve-donor-entities.mjs skips any donor name
-- already present, so a deleted row would be re-matched on its next run; a row with a NULL ABN
-- stays unmatched and donor_map ignores it. What was cleared is kept in
-- donor_entity_match_rejections, so this is reversible row by row.
--
-- NOT touched: graph edges already built from these matches. The build keeps existing edges
-- (ON CONFLICT DO NOTHING), so they stay until the donation edges are re-derived.
--
-- Apply AFTER this file is on main (.claude/skills/db-apply/SKILL.md step 5):
--   scripts/db-apply.sh supabase/migrations/20260922200000_reject_wrong_donor_matches.sql

BEGIN;

CREATE TABLE IF NOT EXISTS donor_entity_match_rejections (
  donor_name           text NOT NULL,
  rejected_abn         text NOT NULL,
  register_name        text,
  total_donated        numeric,
  jev_confidence       numeric,
  reason               text NOT NULL DEFAULT 'jev_different_reviewed',
  rejected_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (donor_name, rejected_abn)
);
ALTER TABLE donor_entity_match_rejections ENABLE ROW LEVEL SECURITY;

INSERT INTO donor_entity_match_rejections (donor_name, rejected_abn, register_name, total_donated, jev_confidence)
VALUES
  ('Rio Tinto Limited', '28076365967', 'MUCHO LOCOS PTY LTD', 6228713.00, 0.990),
  ('Pershing Securities Australia Limited', '60136184962', 'FINCLEAR SERVICES PTY LTD', 929144.00, 0.940),
  ('RMG Services Pty Ltd', '25007756443', 'OZM CARRAPATEENA PTY LTD', 329191.00, 0.930),
  ('Rio Tinto Ltd', '28076365967', 'MUCHO LOCOS PTY LTD', 170813.00, 0.990),
  ('Ashton - CFMEU Mining Lodge', '66009295238', 'A B SCIENCES PTY LTD', 136474.00, 0.980),
  ('Stoddart Group Pty Ltd', '23106426573', 'CALA MOLI CONSULTANCY PTY LTD', 66000.00, 0.960),
  ('CRS Australia', '79072587967', 'BACCHUS MARSH CARWASH PTY LTD', 63150.00, 0.980),
  ('Marques Group Pty Ltd', '37164549455', 'HB LINE PTY LTD', 50000.00, 0.920),
  ('SOMERCITI PTY LTD', '99116995049', 'PRM CAPITAL PTY LIMITED', 50000.00, 0.900),
  ('North Jacklin Pty Ltd', '47009965039', 'NEW ROSS INVESTMENTS PTY LTD', 49000.00, 0.920),
  ('Doyle Capital Limited', '51072450812', 'CHIFLEY INVESTOR GROUP PTY LIMITED', 33000.00, 0.920),
  ('Quasar Constructions Pty Ltd', '86069663403', 'NEWCASTLE BUILDING MANPOWER PTY LTD', 30830.00, 0.950),
  ('Verona Capital Ltd', '70081627830', 'SAVAL CONSULTING PTY LTD', 30000.00, 0.950),
  ('Rothschild Australia Ltd', '32008458366', 'NMR AUSTRALIA PTY LIMITED', 25000.00, 0.930),
  ('Randazzo C & G Developments Pty Ltd', '13055507072', 'MARROSAN INVESTMENTS PTY LTD', 25000.00, 0.910),
  ('ARMS Group Pty Ltd', '88074432670', 'ECOLL PTY LTD', 23000.00, 0.950),
  ('Moggill Constructions Pty Ltd', '86009914541', 'ERTECH (QUEENSLAND) PTY LTD', 20000.00, 0.920),
  ('Randazzo C & G Developments', '13055507072', 'MARROSAN INVESTMENTS PTY LTD', 20000.00, 0.910),
  ('Australia - Israel Chamber of Commerce', '54124113408', 'ACE HEALTHY LIFE PTY LTD', 18367.00, 0.980),
  ('Yuan Chieh Pty Ltd', '92067120370', 'TRONDAGE ENTERPRISES PTY LTD', 18000.00, 0.910),
  ('SCOPE AUSTRALIA', '22604041974', 'BRE-ENGINEERING PTY LTD', 15000.00, 0.960),
  ('Miller Property Corporation Pty Ltd', '80167433669', 'JACHOLLA CONSULTING PTY LTD', 15000.00, 0.980),
  ('Tomato Technologies Limited', '94618726426', 'CAVAON PTY LTD', 13500.00, 0.960),
  ('Miller Property Corporation', '80167433669', 'JACHOLLA CONSULTING PTY LTD', 11000.00, 0.970),
  ('Australian Food Group Pty Ltd', '60006569124', 'MANDRAKE RESOURCES LIMITED', 10000.00, 0.980),
  ('Universal Finance Corporation Pty Ltd', '94107827878', 'JLK INVESTMENTS PTY LTD', 10000.00, 0.980),
  ('Ferro Muller Partnership Pty Ltd', '90093359150', 'FERRO CHOW ARCHITECTURE PTY LTD', 10000.00, 0.960),
  ('Mazars (Qld) Pty Limited', '74102716101', 'EXANT ADVISORY PTY LTD', 8240.00, 0.960),
  ('Ogden International Facilities Corporation Pty Ltd', '12010835551', 'LEGENDS GLOBAL PTY LTD', 7500.00, 0.950),
  ('Xstrata Coal Pty Ltd', '86068703542', 'ABELSHORE PTY LIMITED', 6000.00, 0.910),
  ('Mermaid Cleaning Services', '71077740277', 'BIKE SOLUTIONS PTY LTD', 6000.00, 0.950),
  ('Windward AB Pty Ltd', '79101370772', 'MERIDIEN AB PTY LTD', 5000.00, 0.910),
  ('Magnum Australia Pty Ltd', '86004924994', 'ABSTRACT PTY. LTD.', 5000.00, 0.920),
  ('NLD Australia Pty Ltd', '62069009614', 'EYE CORP AUSTRALIA PTY LTD', 4000.00, 0.930),
  ('McDonald & Murphy Pty Ltd', '13010402114', 'CENTRAL COMBINED GROUP PTY LTD', 4000.00, 0.920),
  ('The Arms Group Pty Ltd', '88074432670', 'ECOLL PTY LTD', 3200.00, 0.920),
  ('Ramsey Meats Pty Ltd', '13004018142', 'CHATSWORTH PTY LTD', 3000.00, 0.920),
  ('McDonald Murphy Pty Ltd', '13010402114', 'CENTRAL COMBINED GROUP PTY LTD', 2000.00, 0.910),
  ('TSB Advisory Pty Ltd', '90604408826', 'RADBURN PARTNERS PTY LTD', 1800.00, 0.930),
  ('NSW Greens', '67007191219', 'UAMBAH PTY LTD', 0.00, 0.930),
  ('Foundation Chanel', '11397570495', 'MICHELLE MOORE', 0.00, 0.960),
  ('PACKER, ROSLYN', '46643891393', 'VARY BIRRFELDER', 0.00, 0.930),
  ('Forgacs Engineering Pty Ltd', '17000019616', 'DONAU PTY LTD', 0.00, 0.940),
  ('Bill Nitchke', '55062171578', 'BILLAL YASSINE', 0.00, 0.960),
  ('Ford Motor Company', '67359085508', 'LEE OSTLE', 0.00, 1.000),
  ('FORD MOTOR COMPANY', '67359085508', 'LEE OSTLE', 0.00, 1.000),
  ('Parliamentary Liberal Party Communications Fund', '23087091085', 'PARITY COMMUNICATIONS PTY. LTD.', 0.00, 0.950),
  ('Paul Ledger & Julian Clayton', '59631376131', 'PAUL CLAYTON', 0.00, 0.940),
  ('Phillips Fox', '14238167471', 'N ABRAMS &amp; Others', 0.00, 0.900),
  ('Family First', '32940116425', 'DAVID UELESE', 0.00, 0.950),
  ('Plumbing and Pipe Trades Employees Union', '84646302545', 'PHILIP WADE', 0.00, 0.990),
  ('ETU National Office', '80101858477', 'H &amp; H GROUP HOLDINGS PTY LTD', 0.00, 0.930),
  ('Blue Co', '11562893812', 'DAVID THWAITS', 0.00, 0.920),
  ('Energy Australia', '73720427728', 'MEREARIHI DEVON', 0.00, 0.990),
  ('ASPIA', '80550997301', 'ISAAC HINES', 0.00, 0.930),
  ('Qld Railways Credit Union', '91087651090', 'MOVEBANK LTD', 0.00, 0.960),
  ('Queensford College', '17129064437', 'Malekhu Investments Pty. Ltd.', 0.00, 0.900),
  ('Embassy of the United Arab Emirates', '99631514264', 'FORREST LEGION PTY LTD', 0.00, 0.990),
  ('QuickSuper', '39668632105', 'JOANNA KUNICKA', 0.00, 0.930),
  ('QUICKSUPER', '39668632105', 'JOANNA KUNICKA', 0.00, 0.920),
  ('RACV', '27983100414', 'ADAM JARRETT', 0.00, 0.980),
  ('RACV Ltd', '27983100414', 'ADAM JARRETT', 0.00, 0.990),
  ('Asgard', '61023382039', 'PAUL HORNSBY', 0.00, 0.940),
  ('Electorate Assistance Committee', '82490287507', 'ELIZABETH CUZNER', 0.00, 0.930),
  ('Electoral Funding Australia', '84969537943', 'BENJAMIN SHUETRIM', 0.00, 0.900),
  ('Duncan Basheer & Hannon', '90698200978', 'M ARENTZ &amp; P.J JACKSON &amp; A NIKOLOVSKI', 0.00, 0.960),
  ('Rob Keldoulis', '68464220921', 'ROEBART TESTERINK', 0.00, 0.950),
  ('SA Labor', '86822107729', 'A.Y ANNANDALE &amp; S.H ANNANDALE', 0.00, 0.940),
  ('DHHS/DoH', '81004092648', 'BINNI PTY LIMITED', 0.00, 0.970),
  ('AON Risk Services Australia Ltd', '48002288646', 'SMARTMONDAY SOLUTIONS LIMITED', 0.00, 0.960),
  ('Aon Risk Services Australia Ltd', '48002288646', 'SMARTMONDAY SOLUTIONS LIMITED', 0.00, 0.970),
  ('AON Risk Services Australia Limited', '48002288646', 'SMARTMONDAY SOLUTIONS LIMITED', 0.00, 0.970),
  ('Dept of the House of Reps (Federal MP''s Levies)', '96622318876', 'ROMAN BAJ', 0.00, 0.990),
  ('SDA Employees Association - SA/NT', '60655045426', 'CK &amp; AB PTY LTD', 0.00, 0.980),
  ('Dept Education & Training - Early Childhood Education Group', '33224489680', 'ELISHA JADE STEWART', 0.00, 0.970),
  ('Department of the Senate', '73154761118', 'AIA INVESTMENTS PTY LTD', 0.00, 1.000),
  ('Department of Jobs and Small Business', '50658250012', 'Tertiary Education Quality and Standards Agency', 0.00, 0.910),
  ('Anna MILANOWICZ', '40450825625', 'KYUNGHYE LEE', 0.00, 0.980),
  ('Anna Milanowicz', '40450825625', 'KYUNGHYE LEE', 0.00, 0.960),
  ('Shop Distributors & Allied Employees Union', '68198043737', 'KRISTAN REGALADO', 0.00, 0.990),
  ('Smith Hancock', '60116945437', 'E.R ALFONSO &amp; P HILLIG', 0.00, 0.910),
  ('AMWU Printing Division', '34709135630', 'TIFFANY FEDDEMA', 0.00, 0.970),
  ('AMWU Metals Division', '59701069556', 'AFZAL PATEL', 0.00, 0.980),
  ('SRO Victoria', '22461633920', 'MARIO VASSALLO', 0.00, 0.920),
  ('Stanton Hillier Parker', '52893251184', 'VINCENZO INZITARI', 0.00, 0.980),
  ('Storm Financial Ltd', '90091752920', 'IGNITE FINANCIAL SYSTEMS &amp; RESEARCH PTY LTD', 0.00, 0.950),
  ('CSIRO Staff Association', '81136897969', 'CANBERRA LACROSSE CLUB', 0.00, 0.990),
  ('Credit Swisse', '11083429458', 'HEY YOU BUY THIS PTY LTD', 0.00, 0.950),
  ('ALP NSW HEAD OFFICE', '84141874062', 'JUNIOR''S 68 PTY LTD', 0.00, 0.990),
  ('Tap Oil Limited', '89068572341', 'TIS ENERGY AUSTRALIA PTY LTD', 0.00, 0.920),
  ('Tap Oil Ltd', '89068572341', 'TIS ENERGY AUSTRALIA PTY LTD', 0.00, 0.910),
  ('COUNTRY LABOR PARTY', '82482899065', 'MARLIE AUSTIN-SMITH', 0.00, 0.990),
  ('Taylor & Scott', '56612312913', 'R.J MCCLENAHAN &amp; I.A SIMIC', 0.00, 0.930),
  ('TAYLOR & SCOTT', '56612312913', 'R.J MCCLENAHAN &amp; I.A SIMIC', 0.00, 0.930),
  ('Telstra', '55251596094', 'NIZAMUL HOQUE', 0.00, 0.990),
  ('The Estate of Late Geoffry Bond', '18073625423', 'The Trustee for The Estate of Late Constance G Levett', 0.00, 0.960),
  ('The Nationals - NSW', '25617620196', 'COLIN RAMSDEN', 0.00, 0.970),
  ('The Nationals NSW', '25617620196', 'COLIN RAMSDEN', 0.00, 0.960),
  ('THE PLUMBING AND PIPE TRADES EMPLOYEES UNION', '84646302545', 'PHILIP WADE', 0.00, 0.990),
  ('The Plumbing and Pipe Trades Employees Union', '84646302545', 'PHILIP WADE', 0.00, 0.990),
  ('The UNE', '80607316886', 'JIATONG SUN', 0.00, 0.970),
  ('Together Branch of The ASU', '31970917470', 'J.C CHRISTENSEN &amp; T.J CHRISTENSEN', 0.00, 0.900),
  ('Transfer From PIZZA PRO PTY LTD Cabins', '20639296012', 'SMART INITIATIVES PTY LTD', 0.00, 0.970),
  ('Travel Counsellors', '37785266938', 'SAMANTHA SLATTERY', 0.00, 0.930),
  ('Broker - Share sale on market - Canaccord Genuity', '97662645892', 'DATA POINT SERVICES PTY LTD', 0.00, 0.900),
  ('Broker - Share Sale on Market - Canaccord Genuity', '97662645892', 'DATA POINT SERVICES PTY LTD', 0.00, 0.920),
  ('AEC Public Funding', '89630119836', 'AUSTRALIAN PREMIUM FABRICATORS PTY LTD', 0.00, 0.960),
  ('TWU of Australia - Federal Council', '49093204687', 'MCP FINANCE PTY LTD', 0.00, 0.990),
  ('TWU of Australia Federal Council', '49093204687', 'MCP FINANCE PTY LTD', 0.00, 0.970),
  ('TWU of Australia National Council', '73099834629', 'The Trustee for THE FRANCIS FAMILY TRUST', 0.00, 0.900),
  ('TWU of NSW', '80835696176', 'A.C CROFT &amp; V CROFT &amp; F.K WONG &amp; M.J WONG', 0.00, 0.960),
  ('TWU OF NSW', '80835696176', 'A.C CROFT &amp; V CROFT &amp; F.K WONG &amp; M.J WONG', 0.00, 0.950),
  ('AEC public funding', '89630119836', 'AUSTRALIAN PREMIUM FABRICATORS PTY LTD', 0.00, 0.930),
  ('UBS Cash Management', '28110577403', 'ULTIMATE BUSINESS SYSTEMS PTY LTD', 0.00, 0.930),
  ('Union Co-op', '34655882202', 'ALI MAJEED', 0.00, 0.950),
  ('Union Co-Op', '34655882202', 'ALI MAJEED', 0.00, 0.950),
  ('Chilla Bulbeck', '78579436435', 'MOLLY WALKER', 0.00, 0.960),
  ('USU - UNITED SERVICES UNION', '40940507928', 'DIANNE ASHWORTH', 0.00, 0.990),
  ('USU - United Services Union', '40940507928', 'DIANNE ASHWORTH', 0.00, 0.970),
  ('Vanuatu Union', '90059333096', 'ASKET ENGINEERING PTY LTD', 0.00, 0.970),
  ('VICTORIA STATE GOVERNMENT', '32649134946', 'NATALIE HOLMES', 0.00, 0.990),
  ('Victorian Greens', '97254538354', 'ALLAN POWELL', 0.00, 0.980),
  ('CFMEU Mining & Energy Qld', '27085306225', 'WATERMASTER INDUSTRIAL PTY. LIMITED', 0.00, 0.990),
  ('CFMEU Mining & Energy (QLD)', '27085306225', 'WATERMASTER INDUSTRIAL PTY. LIMITED', 0.00, 0.990),
  ('CFMEU Mining & Energy - NAF', '23482838379', 'JAMES STAVRIDIS', 0.00, 0.990),
  ('CFMEU', '63624637753', 'SHAUN DESMOND', 0.00, 0.990),
  ('CFME Union of Employees Qld', '90602956070', 'JACLEX PTY LTD', 0.00, 0.970),
  ('VW Osborne Park', '86840601790', 'XIAOJUN WU', 0.00, 0.930),
  ('CEPU Federal Office', '84675664430', 'ALAN TUNNEY', 0.00, 0.980),
  ('WA Labor', '93903913759', 'KARTING WA INC', 0.00, 0.980),
  ('Active Labour Pty Ltd', '84674839509', 'PAUL DAVID SPENCE', 0.00, 0.980),
  ('Active Labour', '84674839509', 'PAUL DAVID SPENCE', 0.00, 0.970),
  ('Action Qld/Metcash', '28799844706', 'NEIL MUNRO', 0.00, 0.980),
  ('ACT Branch ALP', '25637297337', 'ULYSSES CLUB INC', 0.00, 0.940),
  ('Western Institute of Technology', '66126049821', 'WESTERN INVESTMENT AND DEVELOPMENT PTY LTD', 0.00, 0.940),
  ('Westpoint Autos Group', '21113806410', 'O2B FINANCIAL SERVICES PTY LTD', 0.00, 0.980),
  ('CBA', '44447845577', 'TYLA THANH VUONG', 0.00, 0.990),
  ('William James', '65477606848', 'M.J FORREST &amp; B WYHOON', 0.00, 0.900),
  ('worksafe', '31642179920', 'BEN DANG', 0.00, 0.940),
  ('WORKSAFE', '31642179920', 'BEN DANG', 0.00, 0.980),
  ('Worksafe', '31642179920', 'BEN DANG', 0.00, 0.910),
  ('Builders Labourers Federation', '88720449978', 'LUKE HINTON', 0.00, 0.990),
  ('AWU Granville Office', '46588502152', 'AGO ZAHIROVIC', 0.00, 0.910),
  ('AWU (Newcastle Branch)', '43656383934', 'ANB CO PTY LTD', 0.00, 0.920),
  ('AWU PT Kembla Branch', '49123548664', 'JOHN CRACKNELL', 0.00, 0.950),
  ('Jessica Elizabeth White', '51386168639', 'JESS GROVES', 0.00, 0.900),
  ('AWU Western Australia Branch', '38002563500', 'AUSTRALIAN WRITERS'' GUILD LTD', 0.00, 0.920),
  ('ITUC-CSI IGB', '67135597376', 'ORFAN PTY. LTD.', 0.00, 0.980),
  ('Australian Workers Union National', '49056772966', 'AUSTRALIA NATIONAL PTY. LIMITED', 0.00, 0.900),
  ('INFOTECH PROEFSSIONALS PTY LTD', '96279529695', 'ADRIAN ASTWOOD', 0.00, 0.960),
  ('LABOR CAMPAIGN PTY LTD', '38700570394', 'ANTHONY EVANS', 0.00, 0.980),
  ('Labor Campaign Pty Ltd', '38700570394', 'ANTHONY EVANS', 0.00, 0.980),
  ('Australian Tax Authority', '23601120601', 'KPJ TAXATION PTY. LTD.', 0.00, 0.980),
  ('Australian Submarine Corporation Pty Ltd', '13127163722', 'Deep Blue Tech Pty Ltd', 0.00, 0.960),
  ('Bank First', '81553916491', 'The Trustee for ARNOLFO LAW OFFICE SERVICES TRUST', 0.00, 0.940),
  ('Liberal Democratic Party', '53667389929', 'LIBERTARIAN PARTY NSW', 0.00, 0.950),
  ('Liquor & Gaming Commission of South Australia', '71007768416', 'S.A. LIQUOR DISTRIBUTORS LIMITED', 0.00, 0.920),
  ('Lisa Miller &amp; Cameron Adams', '30358450194', 'MELISSA WOOD', 0.00, 0.990),
  ('LNP Headquarters (Loan)', '86998756445', 'LINHENG LIU', 0.00, 0.990),
  ('LPA Federal Secretariat', '84742578583', 'ELIZABETH LENA', 0.00, 0.950),
  ('HSU National Office', '84168196411', 'GEOFERY DUKU', 0.00, 0.960),
  ('House of Reps/Senate', '40608749499', 'CAUDAX CONSULTING PTY. LTD.', 0.00, 0.980),
  ('Australian Nursing and Midwifery Federeation (ANMF) Federal Office - Melbourne', '29010971329', 'OG (QLD) PTY LTD', 0.00, 0.970),
  ('Macquarie Prvate Wealth', '40165422131', 'FORBES WEALTH PTY LTD', 0.00, 0.930),
  ('HomeWorkers Code of Practice', '33631066270', 'JASON DISCOUNT', 0.00, 0.950),
  ('Homeworkers Code of Practice', '33631066270', 'JASON DISCOUNT', 0.00, 0.960),
  ('Markson Sparks Pty Ltd', '62003641398', 'OBELISK VENTURES PTY LIMITED', 0.00, 0.950),
  ('Markson Sparks!', '62003641398', 'OBELISK VENTURES PTY LIMITED', 0.00, 0.900),
  ('Hewlett Packard', '78903504572', 'RAYMOND GHATTAS', 0.00, 0.990),
  ('Matthew Harris & David Belgrove', '17787350185', 'MATTHEW BELGROVE', 0.00, 0.950),
  ('Mavis Pirola', '58280689817', 'ROBYN MURPHY', 0.00, 0.980),
  ('Members of the State Parliament of South Australia', '78082815763', 'COMMUNICATIONS FACTORY PTY LTD', 0.00, 0.970),
  ('Australian Hotel & Hospitality Assoc.', '23366540772', 'GEOFFREY N &amp; VALERIE J SMITH', 0.00, 0.970),
  ('Australian Hotel & Hospitality Assoc', '23366540772', 'GEOFFREY N &amp; VALERIE J SMITH', 0.00, 0.930),
  ('Australian Government Department of Education', '12117324642', 'AUSTRALIA EDUCATION PTY LTD', 0.00, 0.900),
  ('Michelle Stynes & Douglas Garratty', '56322902181', 'MICHELLE BOUTEN', 0.00, 0.950),
  ('MMP Credit Union', '92336384463', 'COLIN CHUANG', 0.00, 0.990),
  ('N.A.B', '84009460403', 'ALICE JOSAF', 0.00, 0.980),
  ('NAB', '84009460403', 'ALICE JOSAF', 0.00, 0.990),
  ('Name 	AUSTRALIAN SERVICES UNION OF NSW', '83645635392', 'NASUN PTY LTD', 0.00, 0.950),
  ('Nature Conservation', '72310724798', 'DANIEL OLIVEIRA SANTANA', 0.00, 0.930),
  ('NATURE CONSERVATION', '72310724798', 'DANIEL OLIVEIRA SANTANA', 0.00, 0.930),
  ('Australia Post SA', '20136063623', 'ABDI RISAQ ISMAIL', 0.00, 0.990),
  ('Australia Post', '33034362830', 'KIM ROWSWELL', 0.00, 0.990),
  ('C.B.A.', '44447845577', 'TYLA THANH VUONG', 0.00, 0.960),
  ('Nick Xenophon', '33612468907', 'LINDBLOMS LAWYERS PTY LTD', 0.00, 0.970),
  ('Nino Mario Volpe', '86773487668', 'NINO SOCCIO', 0.00, 0.930)
ON CONFLICT DO NOTHING;

UPDATE donor_entity_matches m
   SET matched_abn = NULL
  FROM donor_entity_match_rejections r
 WHERE m.donor_name = r.donor_name AND m.matched_abn = r.rejected_abn;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM donor_entity_match_rejections;
  IF n < 187 THEN RAISE EXCEPTION 'expected 187 rejections, found %', n; END IF;
  SELECT count(*) INTO n FROM donor_entity_matches m JOIN donor_entity_match_rejections r
   ON m.donor_name = r.donor_name AND m.matched_abn = r.rejected_abn;
  IF n > 0 THEN RAISE EXCEPTION '% rejected matches still carry their ABN', n; END IF;
END $$;

COMMIT;

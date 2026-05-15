-- Expand funder_allowlist with 18 high-fit funders identified from grant_opportunities open-grants frontier
-- Themes: Indigenous, regenerative, youth justice, community, rural QLD/NT, regional gov, community foundations

INSERT INTO funder_allowlist (funder_name, funder_aliases, primary_themes, jurisdictions, type, application_channel, active, notes)
VALUES
  -- Indigenous-focused philanthropy
  ('Rio Tinto Foundation', ARRAY['Rio Tinto Australia'], ARRAY['indigenous','community','environment','rural_remote'], ARRAY['WA','NT','QLD'], 'corporate_foundation', 'periodic_rounds', true, 'Pilbara + national Indigenous focus'),
  ('The Fogarty Foundation', ARRAY['The Trustee For The Fogarty Foundation'], ARRAY['indigenous','education','community'], ARRAY['WA','National'], 'philanthropic_foundation', 'periodic_rounds', true, 'WA Indigenous education + entrepreneurship'),
  ('Minderoo Foundation', ARRAY['Minderoo Foundation Limited as trustee for The Minderoo Foundation Trust','MINDEROO PICTURES LIMITED'], ARRAY['indigenous','environment','community','arts','health','education'], ARRAY['WA','National'], 'philanthropic_foundation', 'periodic_rounds', true, 'Forrest Family — large generalist'),
  ('The Gelganyem Trust', ARRAY['The Trustee For The Gelganyem Trust'], ARRAY['indigenous','community','land','culture'], ARRAY['WA','National'], 'philanthropic_foundation', 'periodic_rounds', true, 'Kimberley Indigenous trust'),
  ('Moriarty Foundation', ARRAY['John Moriarty Football'], ARRAY['indigenous','youth','sport','community'], ARRAY['NSW','NT','National'], 'philanthropic_foundation', 'periodic_rounds', true, 'John Moriarty Football + Indi Kindi'),
  ('Australian Indigenous Education Foundation', ARRAY['AIEF'], ARRAY['indigenous','education','youth'], ARRAY['National'], 'philanthropic_foundation', 'periodic_rounds', true, 'Indigenous secondary/tertiary scholarships'),
  ('Shark Island Foundation', ARRAY[]::text[], ARRAY['indigenous','arts','documentary','storytelling'], ARRAY['National'], 'philanthropic_foundation', 'periodic_rounds', true, 'Documentary + Indigenous storytelling'),
  ('WCCT Central Sub-Regional Trust', ARRAY['The Trustee For The WCCT Central Sub-Regional Trust','Western Cape Communities Trust'], ARRAY['indigenous','community','arts','environment'], ARRAY['QLD'], 'philanthropic_foundation', 'periodic_rounds', true, 'Cape York / Western Cape Indigenous trust'),

  -- Community / regional foundations
  ('The Mercy Foundation', ARRAY['The Mercy Foundation Limited'], ARRAY['justice','women','homelessness','community'], ARRAY['NSW','National'], 'philanthropic_foundation', 'periodic_rounds', true, 'Social justice + sleeping rough'),
  ('Community Broadcasting Foundation', ARRAY['CBF'], ARRAY['community','media','indigenous','arts'], ARRAY['National'], 'philanthropic_foundation', 'periodic_rounds', true, 'Community radio/TV grants'),
  ('Fay Fuller Community Health Foundation', ARRAY['FAY FULLER COMMUNITY HEALTH FOUNDATION LTD'], ARRAY['health','community','mental_health'], ARRAY['SA','National'], 'philanthropic_foundation', 'periodic_rounds', true, 'SA mental health + community health'),
  ('Geelong Community Foundation', ARRAY['The Trustee For Geelong Community Foundation'], ARRAY['community','rural_remote'], ARRAY['VIC'], 'community_foundation', 'periodic_rounds', true, 'Geelong region'),
  ('Mater Foundation', ARRAY['Mater Foundation Ltd as trustee for the Mater Foundation'], ARRAY['health','community'], ARRAY['QLD'], 'philanthropic_foundation', 'periodic_rounds', true, 'Brisbane health + community'),
  ('RAS Foundation', ARRAY['RAS FOUNDATION LIMITED'], ARRAY['rural_remote','community','education','youth'], ARRAY['NSW','National'], 'philanthropic_foundation', 'periodic_rounds', true, 'Royal Agricultural Society rural philanthropy'),

  -- Corporate community foundations
  ('Coles Group Foundation', ARRAY['Coles Foundation'], ARRAY['food_security','community','education'], ARRAY['National'], 'corporate_foundation', 'periodic_rounds', true, 'Coles community grants'),
  ('CommBank Foundation', ARRAY['Commonwealth Bank Foundation'], ARRAY['mental_health','financial_wellbeing','youth'], ARRAY['National'], 'corporate_foundation', 'periodic_rounds', true, 'CommBank social investment'),

  -- Government — justice & climate (NSW)
  ('NSW Government — Department of Communities and Justice', ARRAY['NSW DCJ','Communities and Justice'], ARRAY['justice','community','youth','indigenous'], ARRAY['NSW'], 'government_agency', 'periodic_rounds', true, 'NSW justice + community services'),
  ('NSW Government — Department of Climate Change, Energy, the Environment and Water', ARRAY['NSW DCCEEW','NSW Climate Change Department'], ARRAY['environment','climate','regenerative','land'], ARRAY['NSW'], 'government_agency', 'periodic_rounds', true, 'NSW environment + climate grants')
ON CONFLICT (funder_name) DO UPDATE SET
  funder_aliases = COALESCE(EXCLUDED.funder_aliases, funder_allowlist.funder_aliases),
  primary_themes = COALESCE(EXCLUDED.primary_themes, funder_allowlist.primary_themes),
  jurisdictions = COALESCE(EXCLUDED.jurisdictions, funder_allowlist.jurisdictions),
  active = true,
  updated_at = NOW();

SELECT COUNT(*) FILTER (WHERE active) as active_funders FROM funder_allowlist;

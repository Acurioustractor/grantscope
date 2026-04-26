-- Sector backfill via canonical_name regex patterns.
-- Targets entities where entity_type is company/charity/social_enterprise/trust/unknown
-- (excluding foundation, government_body, indigenous_corp which were already handled).
-- Each UPDATE is idempotent and safe to re-run.

UPDATE gs_entities SET sector = 'Health'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(health|hospital|medical|clinic|nursing|dental|wellbeing|physio|psychology|psychiatric)\y';

UPDATE gs_entities SET sector = 'Education'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(school|university|college|education|academy|institute|tafe|learning|student|kindergarten|preschool|childcare)\y';

UPDATE gs_entities SET sector = 'Community'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(community|neighbourhood|neighborhood)\y';

UPDATE gs_entities SET sector = 'Religion'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(church|parish|diocese|mission|ministry|catholic|anglican|uniting|baptist|presbyterian|lutheran|synagogue|mosque|temple|islamic|buddhist|hindu|christian)\y';

UPDATE gs_entities SET sector = 'Social Welfare'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(welfare|family services|youth services|homelessness|food bank|refuge|shelter)\y';

UPDATE gs_entities SET sector = 'Legal Services'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(legal|law firm|lawyers|solicitor|barrister)\y';

UPDATE gs_entities SET sector = 'Environment'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(environmental|conservation|climate|biodiversity|wildlife|sustainable|renewable|river|catchment|landcare)\y';

UPDATE gs_entities SET sector = 'Arts & Culture'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(gallery|museum|theatre|cultural|festival|orchestra|ballet|opera|heritage)\y';

UPDATE gs_entities SET sector = 'Sport & Recreation'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(sport|sporting|football|rugby|cricket|tennis|golf|athletic|soccer|basketball|swimming)\y';

UPDATE gs_entities SET sector = 'Housing'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(housing|tenancy|accommodation|shelter)\y';

UPDATE gs_entities SET sector = 'Agriculture'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(agriculture|farming|dairy|livestock|horticulture|viticulture|aquaculture)\y';

UPDATE gs_entities SET sector = 'Construction'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(construction|building|builder|builders|plumbing|electrical|carpentry|roofing)\y';

UPDATE gs_entities SET sector = 'Finance'
 WHERE sector IS NULL
   AND entity_type NOT IN ('foundation', 'government_body', 'indigenous_corp')
   AND canonical_name ~* '\y(bank|banking|financial|finance|investment|insurance|credit union|superannuation)\y';

-- Post-state report
SELECT sector, COUNT(*) as cnt FROM gs_entities WHERE sector IS NOT NULL GROUP BY sector ORDER BY cnt DESC LIMIT 25;
SELECT COUNT(*) FILTER (WHERE sector IS NOT NULL) as w_sector, COUNT(*) FILTER (WHERE sector IS NULL) as no_sector, COUNT(*) as total FROM gs_entities;

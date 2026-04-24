UPDATE grant_opportunities
SET sources = (sources #>> '{}')::jsonb
WHERE sources IS NOT NULL
  AND jsonb_typeof(sources) = 'string'
  AND LEFT(COALESCE(sources #>> '{}', ''), 1) IN ('[', '{');

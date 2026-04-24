#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getArg(name, defaultValue = null) {
  const entry = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : defaultValue;
}

const limit = Number(getArg('--limit', '25')) || 25;
const outPath = getArg('--out', null);

const query = `
WITH fg AS (
  SELECT foundation_id, COUNT(*)::int AS canonical_grants
  FROM foundation_grantees
  GROUP BY foundation_id
),
rel AS (
  SELECT source_entity_id, COUNT(*)::int AS canonical_relationship_grants
  FROM gs_relationships
  WHERE relationship_type = 'grant'
    AND dataset = 'foundation_grantees'
  GROUP BY source_entity_id
),
yrs AS (
  SELECT
    foundation_id,
    COUNT(*)::int AS year_memory_count,
    COUNT(*) FILTER (
      WHERE COALESCE(metadata->>'source', '') NOT ILIKE '%inferred%'
    )::int AS source_backed_count
  FROM foundation_program_years
  GROUP BY foundation_id
)
SELECT
  f.id,
  f.name,
  f.website,
  f.total_giving_annual,
  COALESCE(fg.canonical_grants, 0) AS canonical_grants,
  COALESCE(rel.canonical_relationship_grants, 0) AS canonical_relationship_grants,
  COALESCE(yrs.year_memory_count, 0) AS year_memory_count,
  COALESCE(yrs.source_backed_count, 0) AS source_backed_count,
  (
    COALESCE(fg.canonical_grants, 0)
    + COALESCE(yrs.year_memory_count, 0)
    + COALESCE(yrs.source_backed_count, 0)
  )::int AS richness_score
FROM foundations f
LEFT JOIN fg ON fg.foundation_id = f.id
LEFT JOIN rel ON rel.source_entity_id = f.gs_entity_id
LEFT JOIN yrs ON yrs.foundation_id = f.id
WHERE COALESCE(fg.canonical_grants, 0) > 0
  AND COALESCE(rel.canonical_relationship_grants, 0) > 0
  AND COALESCE(yrs.year_memory_count, 0) > 0
  AND COALESCE(yrs.source_backed_count, 0) > 0
ORDER BY richness_score DESC, COALESCE(f.total_giving_annual, 0) DESC, f.name ASC
LIMIT ${limit}
`;

function formatCurrency(value) {
  if (!value) return 'Amount not listed';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMarkdown(rows) {
  const lines = [
    '# Funding Pilot Cohort',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Pilot-ready foundations found: ${rows.length}`,
    '',
    '| Foundation | Giving | Grants | Year memory | Source-backed | Website |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const row of rows) {
    const website = row.website ? `[site](${row.website})` : '';
    lines.push(
      `| ${row.name.replace(/\|/g, '\\|')} | ${formatCurrency(row.total_giving_annual)} | ${row.canonical_grants} | ${row.year_memory_count} | ${row.source_backed_count} | ${website} |`
    );
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const markdown = formatMarkdown(rows);
  const payload = {
    generated_at: new Date().toISOString(),
    pilot_ready_foundations: rows.length,
    cohort: rows,
  };

  if (outPath) {
    const resolved = path.resolve(process.cwd(), outPath);
    writeFileSync(resolved, markdown, 'utf8');
    console.log(
      JSON.stringify(
        {
          out: resolved,
          pilot_ready_foundations: rows.length,
          cohort_size: rows.length,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildPhilanthropyPowerReport } from '../packages/grant-engine/src/reports/philanthropy-power';

function money(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const report = await buildPhilanthropyPowerReport(supabase);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'output');
  const outPath = path.join(outDir, `philanthropy-power-brief-${timestamp}.md`);

  const content = `# Philanthropy Gatekeepers and Open Capital

Generated: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}

## Headline

- Tracked annual giving: ${money(report.metrics.totalGiving)}
- Foundations with giving data: ${report.metrics.givingFoundationCount.toLocaleString('en-AU')}
- Operators excluded from power map: ${report.metrics.excludedOperatorCount.toLocaleString('en-AU')} (${money(report.metrics.excludedOperatorGiving)})
- Open capital share: ${report.metrics.openCapitalShare.toFixed(1)}%
- Opaque capital share: ${report.metrics.opaqueCapitalShare.toFixed(1)}%
- Relationship-ready foundations: ${report.metrics.relationshipReadyCount.toLocaleString('en-AU')}

## Why this matters

The funding problem is not only scarcity. It is that large amounts of capital remain hard to approach, weakly explained, or heavily concentrated by theme and geography. This brief shows where capital is publicly legible versus where it still behaves like a closed gatekeeping system, after excluding large service operators and institutions that only look like grantmakers in raw data.

## Top Gatekeepers

${report.gatekeepers
  .slice(0, 10)
  .map(
    (foundation, index) =>
      `${index + 1}. **${foundation.name}** — ${money(foundation.totalGiving)} annual giving, class ${foundation.capitalHolderClass.replace(/_/g, ' ')}, openness ${Math.round(
        foundation.opennessScore * 100,
      )}%, themes: ${foundation.thematicFocus.slice(0, 3).join(', ') || 'unspecified'}, reasons: ${
        foundation.reasons.join(', ') || 'no public approach signals'
      }`,
  )
  .join('\n')}

## Most Approachable Large Foundations

${report.relationshipReady
  .slice(0, 10)
  .map(
    (foundation, index) =>
      `${index + 1}. **${foundation.name}** — ${money(foundation.totalGiving)} annual giving, source ${foundation.capitalSourceClass.replace(/_/g, ' ')}, openness ${Math.round(
        foundation.opennessScore * 100,
      )}%, geography: ${foundation.geographicFocus.slice(0, 2).join(', ') || 'National'}, reasons: ${
        foundation.reasons.join(', ') || 'public signals available'
      }`,
  )
  .join('\n')}

## Theme Concentration

${report.themePower
  .slice(0, 10)
  .map(
    (theme, index) =>
      `${index + 1}. **${theme.theme}** — ${money(theme.totalGiving)} across ${theme.foundationCount} foundations, ${theme.openCapitalShare.toFixed(
        1,
      )}% open vs ${theme.opaqueCapitalShare.toFixed(1)}% opaque, top giver: ${theme.topFoundation}`,
  )
  .join('\n')}

## Geography Concentration

${report.geographyPower
  .slice(0, 10)
  .map(
    (geo, index) =>
      `${index + 1}. **${geo.geography}** — ${money(geo.totalGiving)} across ${geo.foundationCount} foundations, ${geo.openCapitalShare.toFixed(
        1,
      )}% relationship-ready, top giver: ${geo.topFoundation}`,
  )
  .join('\n')}
`;

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, content, 'utf8');
  console.log(outPath);
}

main().catch((error) => {
  console.error('[philanthropy-power-brief] Fatal:', error.message);
  process.exit(1);
});

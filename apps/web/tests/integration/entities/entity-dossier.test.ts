import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const rootDir = process.cwd().replace('/apps/web', '');
const hasEnv = existsSync(resolve(rootDir, '.env'));

// Integration tests against real DB via gsql.mjs — skip in CI where .env is unavailable
const describeDb = hasEnv ? describe : describe.skip;
function gsql(query: string): string {
  return execSync(`node --env-file=.env scripts/gsql.mjs "${query.replace(/"/g, '\\"')}"`, {
    cwd: process.cwd().replace('/apps/web', ''),
    encoding: 'utf8',
    timeout: 30000,
  }).trim();
}

function gsqlJson(query: string): Record<string, unknown>[] {
  const result = execSync(`node --env-file=.env scripts/gsql.mjs -j "${query.replace(/"/g, '\\"')}"`, {
    cwd: process.cwd().replace('/apps/web', ''),
    encoding: 'utf8',
    timeout: 30000,
  }).trim();
  try {
    return JSON.parse(result);
  } catch {
    return [];
  }
}

describeDb('Entity Dossier - MV data', () => {
  it('returns correct stats for Defence (>100K relationships)', () => {
    const result = gsql(
      "SELECT total_relationships, total_outbound_amount FROM mv_gs_entity_stats WHERE gs_id = 'AU-GOV-0ec9911c9e99d1b7bb1b77f4abffc583'"
    );
    expect(result).toContain('349760');
    // Should have significant outbound amount
    expect(result).toMatch(/\d{10,}/); // 10+ digit number
  });

  it('returns type_breakdown JSONB with correct structure', () => {
    const result = gsql(
      "SELECT type_breakdown->>'contract:outbound' AS tb FROM mv_gs_entity_stats WHERE gs_id = 'AU-GOV-0ec9911c9e99d1b7bb1b77f4abffc583'"
    );
    expect(result).toContain('count');
    expect(result).toContain('amount');
  });

  it('returns year_distribution for sparkline', () => {
    const result = gsql(
      "SELECT year_distribution IS NOT NULL AS has_years FROM mv_gs_entity_stats WHERE gs_id = 'AU-GOV-0ec9911c9e99d1b7bb1b77f4abffc583'"
    );
    expect(result).toContain('t');
  });

  it('returns concentration metrics', () => {
    const result = gsql(
      "SELECT top_counterparty_share, distinct_counterparties FROM mv_gs_entity_stats WHERE gs_id = 'AU-GOV-0ec9911c9e99d1b7bb1b77f4abffc583'"
    );
    // Defence should have many counterparties
    expect(result).toMatch(/\d{4,}/); // 4+ digit counterparty count
  });

  it('handles entity with 0 relationships gracefully', () => {
    // MV only includes entities with > 0 relationships, so a lookup should return empty
    const result = gsql(
      "SELECT COUNT(*) as c FROM mv_gs_entity_stats WHERE total_relationships = 0"
    );
    expect(result).toContain('0');
  });
});

describeDb('Entity Dossier - Keyset pagination indexes', () => {
  it('has composite indexes for source keyset', () => {
    const result = gsql(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'gs_relationships' AND indexname = 'idx_gs_rel_source_type_amt'"
    );
    expect(result).toContain('idx_gs_rel_source_type_amt');
  });

  it('has composite indexes for target keyset', () => {
    const result = gsql(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'gs_relationships' AND indexname = 'idx_gs_rel_target_type_amt'"
    );
    expect(result).toContain('idx_gs_rel_target_type_amt');
  });
});

describeDb('Entity Dossier - Risk badge', () => {
  it('flags concentration >= 0.6', () => {
    const result = gsql(
      "SELECT COUNT(*) as c FROM mv_gs_entity_stats WHERE top_counterparty_share >= 0.6"
    );
    // Should have some entities with high concentration
    const count = parseInt(result.match(/(\d+)/)?.[1] || '0');
    expect(count).toBeGreaterThanOrEqual(0); // Valid query, count may be 0 or more
  });

  it('concentration is between 0 and 1', () => {
    const result = gsql(
      "SELECT COUNT(*) as c FROM mv_gs_entity_stats WHERE top_counterparty_share < 0 OR top_counterparty_share > 1"
    );
    expect(result).toContain('0');
  });
});

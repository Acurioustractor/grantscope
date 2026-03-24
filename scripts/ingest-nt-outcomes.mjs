#!/usr/bin/env node
/**
 * Ingest NT-specific youth justice outcomes metrics and policy events.
 *
 * Sources:
 *   - NT Children's Commissioner 2024 ("Our Most Vulnerable Children")
 *   - NT Corrections Youth Detention Census
 *   - NT Corrections annual reports
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-nt-outcomes.mjs
 *
 * This is a thin wrapper that runs the SQL file via psql.
 * The actual data lives in scripts/sql/ingest-nt-outcomes.sql
 */
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlFile = resolve(__dirname, 'sql/ingest-nt-outcomes.sql');

const host = 'aws-0-ap-southeast-2.pooler.supabase.com';
const port = 5432;
const user = `postgres.${process.env.SUPABASE_PROJECT_ID || 'tednluwflfhxyucgwigh'}`;
const db = 'postgres';

console.log('[ingest-nt-outcomes] Running SQL file:', sqlFile);

try {
  const result = execSync(
    `PGPASSWORD="${process.env.DATABASE_PASSWORD}" psql -h ${host} -p ${port} -U "${user}" -d ${db} -f "${sqlFile}"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  console.log(result);
  console.log('[ingest-nt-outcomes] Done.');
} catch (err) {
  console.error('[ingest-nt-outcomes] Failed:', err.stderr || err.message);
  process.exit(1);
}

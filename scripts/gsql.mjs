#!/usr/bin/env node
/**
 * gsql — GrantScope SQL query tool
 *
 * Handles ALL SQL: SELECT queries via service role RPC, DDL/DML via direct psql.
 * Sees ALL tables. No password rotation. No MCP limitations.
 *
 * Usage:
 *   node scripts/gsql.mjs "SELECT COUNT(*) FROM gs_entities"
 *   node scripts/gsql.mjs "REFRESH MATERIALIZED VIEW mv_funding_by_postcode"
 *   node scripts/gsql.mjs --file path/to/query.sql
 *   echo "SELECT 1" | node scripts/gsql.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  let sql;

  const args = process.argv.slice(2);
  if (args[0] === '--file' && args[1]) {
    sql = readFileSync(args[1], 'utf8');
  } else if (args.length > 0) {
    sql = args.join(' ');
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    sql = Buffer.concat(chunks).toString('utf8').trim();
  }

  if (!sql) {
    console.error('Usage: gsql "SELECT ..." | gsql --file query.sql');
    process.exit(1);
  }

  // Detect if this is a SELECT/query or DDL/DML
  const isQuery = /^\s*(select|with|values|table)\b/i.test(sql.trim());

  if (isQuery) {
    // Use exec_sql RPC (service role key, stable, fast)
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    printResult(data);
  } else {
    // Use direct psql for DDL/DML (stable dashboard password)
    const dbPassword = process.env.DATABASE_PASSWORD;
    if (!dbPassword) {
      console.error('DATABASE_PASSWORD not set in .env — get it from Supabase Dashboard > Settings > Database');
      process.exit(1);
    }
    try {
      const result = execSync(
        `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${sql.replace(/"/g, '\\"')}"`,
        { env: { ...process.env, PGPASSWORD: dbPassword }, encoding: 'utf8', timeout: 120000 }
      );
      console.log(result.trim());
    } catch (e) {
      console.error(e.stderr || e.message);
      process.exit(1);
    }
  }
}

function printResult(data) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.log('(0 rows)');
    return;
  }

  if (!Array.isArray(data)) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const cols = Object.keys(data[0]);
  const widths = cols.map(c =>
    Math.max(c.length, ...data.map(r => String(r[c] ?? '').length))
  );

  const header = cols.map((c, i) => c.padEnd(widths[i])).join(' | ');
  const sep = widths.map(w => '-'.repeat(w)).join('-+-');
  console.log(header);
  console.log(sep);

  for (const row of data) {
    const line = cols.map((c, i) => String(row[c] ?? '').padEnd(widths[i])).join(' | ');
    console.log(line);
  }

  console.log(`\n(${data.length} row${data.length !== 1 ? 's' : ''})`);
}

run().catch(e => {
  console.error(e.message);
  process.exit(1);
});

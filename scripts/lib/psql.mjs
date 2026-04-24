/**
 * psql.mjs — Shared psql query helper
 *
 * Runs a SQL query via the psql CLI, parses CSV output into objects.
 * Used by watcher agents, scrapers, linkers, and other pipeline scripts.
 *
 * Usage:
 *   import { psql } from './lib/psql.mjs';
 *   const rows = psql("SELECT id, name FROM gs_entities LIMIT 10");
 *
 * Options:
 *   psql(sql, { timeout: 300000, parse: true, maxBuffer: 200 * 1024 * 1024, label: 'my-script' })
 *   - timeout: ms before killing the process (default: 120000)
 *   - parse: if false, returns raw string output (default: true)
 *   - maxBuffer: max stdout buffer in bytes (default: 50MB)
 *   - label: prefix for temp file names (default: 'psql')
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const DOTENV_PATH = path.join(ROOT, '.env');

function readEnvFileValue(key) {
  try {
    const text = readFileSync(DOTENV_PATH, 'utf8');
    const line = text
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : null;
  } catch {
    return null;
  }
}

function resolveDatabaseUrl() {
  let databaseUrl = readEnvFileValue('DATABASE_URL') || process.env.DATABASE_URL || null;
  const supabaseUrl = readEnvFileValue('SUPABASE_URL') || process.env.SUPABASE_URL || null;

  if (databaseUrl && databaseUrl.includes('.pooler.supabase.com') && supabaseUrl) {
    try {
      const parsedSupabaseUrl = new URL(supabaseUrl);
      const projectRef = parsedSupabaseUrl.hostname.split('.')[0];
      const parsedDatabaseUrl = new URL(databaseUrl);
      parsedDatabaseUrl.hostname = `db.${projectRef}.supabase.co`;
      if (parsedDatabaseUrl.username.includes('.')) {
        parsedDatabaseUrl.username = parsedDatabaseUrl.username.split('.')[0];
      }
      databaseUrl = parsedDatabaseUrl.toString();
    } catch {
      return databaseUrl;
    }
  }

  return databaseUrl;
}

const CONN_STR = resolveDatabaseUrl();

/**
 * Execute a SQL query via psql and return parsed rows.
 *
 * @param {string} sql - The SQL query to execute
 * @param {object} [opts] - Options
 * @param {number} [opts.timeout=120000] - Timeout in milliseconds
 * @param {boolean} [opts.parse=true] - Whether to parse CSV into objects
 * @param {number} [opts.maxBuffer=52428800] - Max stdout buffer in bytes
 * @param {string} [opts.label='psql'] - Label for temp file naming
 * @returns {object[]|string} Parsed rows as objects, or raw string if parse=false
 */
export function psql(sql, { timeout = 120000, parse = true, maxBuffer = 50 * 1024 * 1024, label = 'psql' } = {}) {
  if (!CONN_STR) {
    console.error('psql error: DATABASE_URL not available');
    return parse ? [] : '';
  }

  const tmpFile = `/tmp/${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.sql`;
  writeFileSync(tmpFile, sql);
  try {
    const result = execSync(
      `psql "${CONN_STR}" --csv -f ${tmpFile} 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer, timeout }
    );
    unlinkSync(tmpFile);
    if (!parse) return result;

    // Multiline-aware CSV parser (handles quoted fields with newlines and escaped quotes)
    const rows = [];
    let cur = '', inQ = false, vals = [];
    const chars = result.trim();
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === '"') {
        if (inQ && chars[i + 1] === '"') { cur += '"'; i++; continue; } // escaped quote
        inQ = !inQ; continue;
      }
      if (ch === ',' && !inQ) { vals.push(cur); cur = ''; continue; }
      if (ch === '\n' && !inQ) { vals.push(cur); rows.push(vals); vals = []; cur = ''; continue; }
      if (ch === '\r' && !inQ) continue; // skip \r
      cur += ch;
    }
    if (cur || vals.length > 0) { vals.push(cur); rows.push(vals); }
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(vals => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] || '');
      return obj;
    });
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    console.error('psql error:', err.message?.slice(0, 300));
    return parse ? [] : '';
  }
}

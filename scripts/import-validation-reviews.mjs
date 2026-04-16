#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const [, , inputPath, ...args] = process.argv;
const APPLY = args.includes('--apply');

if (!inputPath) {
  console.error('Usage: node --env-file=.env scripts/import-validation-reviews.mjs <csv-path> [--apply]');
  process.exit(1);
}

function cleanText(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanBoolean(value) {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  if (['yes', 'y', 'true', '1'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0'].includes(normalized)) return false;
  return null;
}

function cleanNumber(value) {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanDate(value) {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeRecordType(value) {
  const normalized = cleanText(value)?.toLowerCase();
  if (normalized === 'grant' || normalized === 'foundation') return normalized;
  return null;
}

function normalizeStatus(value) {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === 'correct') return 'correct';
  if (normalized === 'usable_but_incomplete' || normalized === 'usable but incomplete') return 'usable_but_incomplete';
  if (normalized === 'wrong_noisy' || normalized === 'wrong/noisy' || normalized === 'wrong noisy') return 'wrong_noisy';
  return null;
}

function buildRowKey(row) {
  const parts = [
    row.review_date || 'undated',
    row.reviewer || 'unknown-reviewer',
    row.record_type || 'unknown-record',
    row.surface || 'unknown-surface',
    row.source || 'unknown-source',
    row.record_id || row.record_name || row.notes || Math.random().toString(36).slice(2, 10),
  ];
  return parts
    .join('::')
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 240);
}

async function main() {
  const absolutePath = resolve(process.cwd(), inputPath);
  const csv = readFileSync(absolutePath, 'utf8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });

  const normalized = rows
    .map((row) => {
      const review_date = cleanDate(row.review_date);
      const record_type = normalizeRecordType(row.record_type);
      const status = normalizeStatus(row.status);

      if (!review_date || !record_type || !status) return null;

      const normalizedRow = {
        review_date,
        reviewer: cleanText(row.reviewer),
        record_type,
        surface: cleanText(row.surface),
        source: cleanText(row.source),
        record_id: cleanText(row.record_id),
        record_name: cleanText(row.record_name),
        status,
        issue_type: cleanText(row.issue_type),
        url_works: cleanBoolean(row.url_works),
        open_now_correct: cleanBoolean(row.open_now_correct),
        deadline_correct: cleanBoolean(row.deadline_correct),
        amount_correct: cleanBoolean(row.amount_correct),
        provider_correct: cleanBoolean(row.provider_correct),
        match_relevance_score: cleanNumber(row.match_relevance_score),
        relationship_signal_score: cleanNumber(row.relationship_signal_score),
        actionability_score: cleanNumber(row.actionability_score),
        notes: cleanText(row.notes),
        recommended_fix: cleanText(row.recommended_fix),
        owner: cleanText(row.owner),
      };

      return {
        ...normalizedRow,
        updated_at: new Date().toISOString(),
        row_key: buildRowKey(normalizedRow),
      };
    })
    .filter(Boolean);

  console.log(`Validation review import`);
  console.log(`  CSV: ${absolutePath}`);
  console.log(`  Rows parsed: ${rows.length}`);
  console.log(`  Valid rows: ${normalized.length}`);
  console.log(`  Mode: ${APPLY ? 'apply' : 'dry-run'}`);

  if (!APPLY || normalized.length === 0) return;

  const { error } = await supabase
    .from('validation_reviews')
    .upsert(normalized, { onConflict: 'row_key' });

  if (error) {
    console.error(`Import failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`  Upserted: ${normalized.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

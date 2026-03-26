#!/usr/bin/env node
/**
 * Auto-ingest outcomes from program reports (PDF/text)
 *
 * Uses Claude API to extract structured outcomes data from program reports,
 * annual reports, or evaluation documents. Creates outcome_submissions
 * linked to gs_entities via ABN.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-report-outcomes.mjs --file report.pdf
 *   node --env-file=.env scripts/ingest-report-outcomes.mjs --file report.pdf --org-abn 12345678901
 *   node --env-file=.env scripts/ingest-report-outcomes.mjs --file report.pdf --apply
 *   node --env-file=.env scripts/ingest-report-outcomes.mjs --dir data/reports/ --apply
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { basename, extname, join } from 'path';
import { execSync } from 'child_process';

const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LLM_API_KEY = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
const LLM_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.anthropic.com/v1';
const LLM_MODEL = process.env.MINIMAX_API_KEY ? 'MiniMax-M2.5' : 'claude-sonnet-4-20250514';
const IS_MINIMAX = !!process.env.MINIMAX_API_KEY;

async function callLLM(messages) {
  if (IS_MINIMAX) {
    // OpenAI-compatible format (MiniMax)
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        max_tokens: 4096,
      }),
    });
    if (!res.ok) throw new Error(`LLM API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    // Strip <think>...</think> tags from MiniMax reasoning output
    return data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
  } else {
    // Anthropic native format
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LLM_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 4096,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`LLM API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.content[0].text;
  }
}

const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');
const fileArg = process.argv.find(a => a.startsWith('--file='))?.split('=')[1];
const dirArg = process.argv.find(a => a.startsWith('--dir='))?.split('=')[1];
const orgAbn = process.argv.find(a => a.startsWith('--org-abn='))?.split('=')[1];
const orgName = process.argv.find(a => a.startsWith('--org-name='))?.split('=')[1];

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

const EXTRACTION_PROMPT = `You are an outcomes data extraction specialist for CivicGraph, an Australian accountability platform.

Extract structured program outcomes from this document. Focus on:
- Quantitative metrics (participants served, completion rates, recidivism reduction, etc.)
- Qualitative outcomes (community feedback, cultural impact, stakeholder assessments)
- Program details (name, reporting period, methodology)
- Organisation details (name, ABN if mentioned)

Return a JSON object with this exact structure:
{
  "org_name": "Organisation Name",
  "org_abn": "12345678901 or null",
  "program_name": "Program Name",
  "reporting_period": "FY2024-25 or Q1 2025 etc",
  "outcomes": [
    { "metric": "metric_name", "value": 123, "unit": "participants|percent|count|dollars|hours|score", "description": "optional context" }
  ],
  "narrative": "1-3 sentence summary of key findings",
  "methodology": "How outcomes were measured",
  "state": "NSW|VIC|QLD|SA|WA|TAS|NT|ACT|National or null",
  "postcode": "postcode if mentioned or null",
  "confidence": "high|medium|low — how confident are you in the extraction accuracy"
}

Rules:
- Extract ALL quantifiable outcomes, not just headline numbers
- Use standard metric names: participants_served, completion_rate, reoffending_reduction, school_attendance, employment_outcomes, cultural_activities, community_satisfaction, families_supported, referrals_made, cost_savings, young_people_diverted, housing_placements, mental_health_improvements
- If the document mentions multiple programs, return an array of objects (one per program)
- If you can't find outcomes data, return { "error": "no_outcomes_found", "reason": "..." }
- ABN format: 11 digits, no spaces
- Be conservative with values — only extract what's explicitly stated, don't infer`;

async function extractTextFromPdf(filePath) {
  try {
    // Try pdftotext first (poppler)
    const text = execSync(`pdftotext "${filePath}" -`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
    return text;
  } catch {
    // Fallback: read as binary and send to Claude with PDF support
    return null;
  }
}

async function extractOutcomes(filePath) {
  const ext = extname(filePath).toLowerCase();
  let content;
  let messages;

  if (ext === '.pdf') {
    // Try text extraction first
    const text = await extractTextFromPdf(filePath);
    if (text && text.trim().length > 100) {
      content = text;
      messages = [{
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\nDocument (${basename(filePath)}):\n\n${content.slice(0, 100000)}`
      }];
    } else {
      // Send PDF as base64 to Claude
      const pdfBytes = readFileSync(filePath);
      const base64 = pdfBytes.toString('base64');
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        ]
      }];
    }
  } else {
    // Plain text / markdown
    content = readFileSync(filePath, 'utf-8');
    messages = [{
      role: 'user',
      content: `${EXTRACTION_PROMPT}\n\nDocument (${basename(filePath)}):\n\n${content.slice(0, 100000)}`
    }];
  }

  const text = await callLLM(messages);

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    throw new Error('No JSON found in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function resolveEntity(name, abn) {
  // Try ABN first
  if (abn) {
    const cleaned = abn.replace(/\s/g, '');
    if (/^\d{11}$/.test(cleaned)) {
      const { data } = await db
        .from('gs_entities')
        .select('id, gs_id, canonical_name, abn')
        .eq('abn', cleaned)
        .limit(1);
      if (data?.length) return data[0];
    }
  }

  // Name match
  if (name) {
    const { data } = await db
      .from('gs_entities')
      .select('id, gs_id, canonical_name, abn')
      .ilike('canonical_name', `%${name}%`)
      .limit(5);
    if (data?.length === 1) return data[0];
    if (data?.length > 1) {
      const exact = data.find(e => e.canonical_name.toLowerCase() === name.toLowerCase());
      if (exact) return exact;
      return data.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
    }
  }

  return null;
}

async function processFile(filePath) {
  log(`Processing: ${basename(filePath)}`);

  const results = await extractOutcomes(filePath);

  for (const result of results) {
    if (result.error) {
      log(`  ⊘ No outcomes found: ${result.reason}`);
      continue;
    }

    // Override org details if provided via CLI
    const finalAbn = orgAbn || result.org_abn;
    const finalName = orgName || result.org_name;

    // Resolve entity
    const entity = await resolveEntity(finalName, finalAbn);

    log(`  Program: ${result.program_name}`);
    log(`  Org: ${finalName}${entity ? ` → ${entity.canonical_name} (${entity.gs_id})` : ' (unlinked)'}`);
    log(`  Period: ${result.reporting_period}`);
    log(`  Outcomes: ${result.outcomes?.length || 0} metrics`);
    log(`  Confidence: ${result.confidence || 'unknown'}`);

    if (VERBOSE && result.outcomes) {
      for (const o of result.outcomes) {
        log(`    • ${o.metric}: ${o.value} ${o.unit}${o.description ? ` — ${o.description}` : ''}`);
      }
    }

    if (result.narrative) {
      log(`  Narrative: ${result.narrative.slice(0, 120)}...`);
    }

    if (APPLY) {
      const { data, error } = await db
        .from('outcome_submissions')
        .insert({
          org_name: finalName,
          org_abn: finalAbn || null,
          gs_entity_id: entity?.gs_id || null,
          program_name: result.program_name,
          reporting_period: result.reporting_period,
          outcomes: result.outcomes,
          narrative: result.narrative || null,
          methodology: result.methodology || null,
          state: result.state || null,
          postcode: result.postcode || null,
          status: 'submitted',
        })
        .select('id')
        .single();

      if (error) {
        log(`  ✗ Insert error: ${error.message}`);
      } else {
        log(`  ✓ Created submission ${data.id}`);
      }
    } else {
      log(`  [DRY RUN] Would create submission`);
    }
  }

  return results;
}

async function main() {
  log('═══ Program Report Outcomes Ingester ═══');
  log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  const files = [];

  if (fileArg) {
    files.push(fileArg);
  } else if (dirArg) {
    const entries = readdirSync(dirArg);
    for (const entry of entries) {
      const full = join(dirArg, entry);
      const ext = extname(entry).toLowerCase();
      if (['.pdf', '.txt', '.md'].includes(ext) && statSync(full).isFile()) {
        files.push(full);
      }
    }
  } else {
    console.error('Usage: --file=<path> or --dir=<path>');
    process.exit(1);
  }

  log(`Files to process: ${files.length}`);

  let totalOutcomes = 0;
  let totalFiles = 0;

  for (const file of files) {
    try {
      const results = await processFile(file);
      const outcomes = results.filter(r => !r.error);
      totalOutcomes += outcomes.reduce((sum, r) => sum + (r.outcomes?.length || 0), 0);
      totalFiles++;
    } catch (err) {
      log(`  ✗ Error processing ${basename(file)}: ${err.message}`);
    }
  }

  log(`\n═══ SUMMARY ═══`);
  log(`  Files processed: ${totalFiles}/${files.length}`);
  log(`  Total outcome metrics extracted: ${totalOutcomes}`);
  log(`  Mode: ${APPLY ? 'APPLIED' : 'DRY RUN'}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

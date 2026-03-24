#!/usr/bin/env node
/**
 * Test the digest generation locally without needing the Vercel deployment.
 * Usage: node --env-file=.env scripts/test-digest.mjs
 */
import { createClient } from '@supabase/supabase-js';
// Use Gemini (available in env) via REST API

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 7); // last 7 days for testing
  const sinceStr = since.toISOString();

  console.log(`Gathering data from ${since.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}...`);

  const [
    { data: newStatements },
    { data: newHansard },
    { data: newAlerts },
    { data: commitments },
    { data: recentFunding },
    { data: lastDigest },
  ] = await Promise.all([
    db.from('civic_ministerial_statements')
      .select('id, headline, minister_name, portfolio, published_at, mentioned_amounts, body_text')
      .gte('published_at', sinceStr)
      .order('published_at', { ascending: false })
      .limit(30),
    db.from('civic_hansard')
      .select('id, sitting_date, speaker_name, speaker_party, speaker_role, speech_type, subject, body_text')
      .gte('scraped_at', sinceStr)
      .order('sitting_date', { ascending: false })
      .limit(20),
    db.from('civic_alerts')
      .select('id, alert_type, severity, title, summary, linked_records, created_at')
      .gte('created_at', sinceStr)
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('civic_charter_commitments')
      .select('id, minister_name, commitment_text, status, status_evidence, category, youth_justice_relevant')
      .eq('youth_justice_relevant', true)
      .order('minister_name'),
    db.from('justice_funding')
      .select('program_name, recipient_name, amount_dollars, financial_year')
      .eq('state', 'QLD')
      .order('amount_dollars', { ascending: false })
      .limit(10),
    db.from('civic_digests')
      .select('commitment_snapshot, created_at')
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  console.log(`Found: ${newStatements?.length || 0} statements, ${newHansard?.length || 0} hansard, ${newAlerts?.length || 0} alerts, ${commitments?.length || 0} commitments`);

  // Detect status changes
  const previousSnapshot = (lastDigest?.[0]?.commitment_snapshot || {});
  const statusChanges = [];
  const currentSnapshot = {};

  for (const c of (commitments || [])) {
    currentSnapshot[c.id] = c.status;
    const prev = previousSnapshot[c.id];
    if (prev && prev !== c.status) {
      statusChanges.push({
        commitment: c.commitment_text.slice(0, 100),
        from: prev,
        to: c.status,
        minister: c.minister_name,
      });
    }
  }

  // Build prompt
  const statementsCtx = (newStatements || []).map(s =>
    `- "${s.headline}" by ${s.minister_name || 'Unknown'} (${s.published_at?.slice(0, 10) || 'undated'})${s.mentioned_amounts?.length ? ` [${s.mentioned_amounts.join(', ')}]` : ''}`
  ).join('\n');

  const hansardCtx = (newHansard || []).map(h =>
    `- ${h.speaker_name} (${h.speaker_party || '?'}, ${h.speaker_role || 'backbench'}): "${h.subject || h.body_text?.slice(0, 80) || 'no subject'}" [${h.sitting_date}]`
  ).join('\n');

  const alertsCtx = (newAlerts || []).map(a =>
    `- [${a.severity}] ${a.title}: ${a.summary?.slice(0, 120) || ''}`
  ).join('\n');

  const commitmentCtx = (commitments || []).map(c =>
    `- [${c.status}] ${c.minister_name}: "${c.commitment_text.slice(0, 80)}" ${c.status_evidence ? `(${c.status_evidence})` : ''}`
  ).join('\n');

  const changesCtx = statusChanges.length > 0
    ? statusChanges.map(c => `- ${c.minister}: "${c.commitment}" moved from ${c.from} → ${c.to}`).join('\n')
    : 'No commitment status changes since last digest.';

  const fundingCtx = (recentFunding || []).map(f =>
    `- ${f.program_name}: $${((f.amount_dollars || 0) / 1e6).toFixed(1)}M (${f.recipient_name}, ${f.financial_year})`
  ).join('\n');

  const prompt = `You are CivicScope, an intelligence analyst tracking Queensland government accountability on youth justice.

Generate a weekly intelligence briefing for the period ${since.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}.

## NEW MINISTERIAL STATEMENTS (${newStatements?.length || 0})
${statementsCtx || 'None'}

## NEW HANSARD SPEECHES (${newHansard?.length || 0})
${hansardCtx || 'None'}

## NEW ALERTS (${newAlerts?.length || 0})
${alertsCtx || 'None'}

## CHARTER COMMITMENT STATUS (${commitments?.length || 0} youth justice commitments)
${commitmentCtx || 'None'}

## STATUS CHANGES SINCE LAST DIGEST
${changesCtx}

## TOP QLD FUNDING
${fundingCtx || 'None'}

---

Write a concise, insightful briefing (300-500 words) that:
1. Opens with the most significant development
2. Highlights any GAPS between what ministers promised and what they're doing/funding
3. Notes any contradictions between statements and parliamentary speeches
4. Flags commitment status changes with context
5. Identifies trends (increasing/decreasing attention to youth justice)
6. Ends with 2-3 things to watch next week

Write in a direct, analytical tone. No preamble. Use specific names, dates, and dollar amounts.`;

  console.log('\nCalling Groq API...\n');

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    throw new Error(`Groq API ${groqRes.status}: ${err}`);
  }

  const groqData = await groqRes.json();
  const summary = groqData.choices?.[0]?.message?.content || 'No summary generated';
  console.log('═══════════════════════════════════════════════════════');
  console.log('CIVICSCOPE INTELLIGENCE BRIEFING');
  console.log(`Period: ${since.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`);
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(summary);
  console.log('\n═══════════════════════════════════════════════════════');

  // Insert into DB
  const digestRecord = {
    period_start: since.toISOString().slice(0, 10),
    period_end: now.toISOString().slice(0, 10),
    digest_type: 'weekly',
    summary,
    raw_data: {
      statement_ids: (newStatements || []).map(s => s.id),
      hansard_ids: (newHansard || []).map(h => h.id),
      alert_ids: (newAlerts || []).map(a => a.id),
    },
    commitment_snapshot: currentSnapshot,
    statement_count: newStatements?.length || 0,
    hansard_count: newHansard?.length || 0,
    alert_count: newAlerts?.length || 0,
    new_links: newAlerts?.length || 0,
    status_changes: statusChanges,
    jurisdiction: 'QLD',
  };

  const { error } = await db.from('civic_digests').insert(digestRecord);
  if (error) {
    console.error('Insert error:', error.message);
  } else {
    console.log('\nDigest saved to civic_digests table.');
  }
}

run().catch(err => { console.error(err); process.exit(1); });

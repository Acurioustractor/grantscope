import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * CivicScope Intelligence Digest
 *
 * Generates an AI-powered briefing by analyzing recent civic data changes.
 * Runs daily via Vercel cron — fully cloud-based, no local machine needed.
 *
 * GET /api/civicscope/digest?period=daily&send_telegram=true
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET || process.env.API_SECRET_KEY;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const period = request.nextUrl.searchParams.get('period') || 'daily';
  const sendTelegram = request.nextUrl.searchParams.get('send_telegram') !== 'false';
  const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true';
  const db = getServiceSupabase();

  const now = new Date();
  const periodDays = period === 'weekly' ? 7 : 1;
  const since = new Date(now);
  since.setDate(since.getDate() - periodDays);
  const sinceStr = since.toISOString();

  try {
    // ── Gather all recent data in parallel ──
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
        .gte('scraped_at', sinceStr)
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

    // ── Detect commitment status changes since last digest ──
    const previousSnapshot = (lastDigest?.[0]?.commitment_snapshot || {}) as Record<string, string>;
    const statusChanges: Array<{ commitment: string; from: string; to: string; minister: string }> = [];
    const currentSnapshot: Record<string, string> = {};

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

    // ── Build context for Claude ──
    const statementsContext = (newStatements || []).map(s =>
      `- "${s.headline}" by ${s.minister_name || 'Unknown'} (${s.published_at?.slice(0, 10) || 'undated'})${s.mentioned_amounts?.length ? ` [${s.mentioned_amounts.join(', ')}]` : ''}`
    ).join('\n');

    const hansardContext = (newHansard || []).map(h =>
      `- ${h.speaker_name} (${h.speaker_party || 'unknown'}, ${h.speaker_role || 'backbench'}): "${h.subject || h.body_text?.slice(0, 80) || 'no subject'}" [${h.sitting_date}]`
    ).join('\n');

    const alertsContext = (newAlerts || []).map(a =>
      `- [${a.severity}] ${a.title}: ${a.summary?.slice(0, 120) || ''}`
    ).join('\n');

    const commitmentContext = (commitments || []).map(c =>
      `- [${c.status}] ${c.minister_name}: "${c.commitment_text.slice(0, 80)}" ${c.status_evidence ? `(${c.status_evidence})` : ''}`
    ).join('\n');

    const changesContext = statusChanges.length > 0
      ? statusChanges.map(c => `- ${c.minister}: "${c.commitment}" moved from ${c.from} → ${c.to}`).join('\n')
      : 'No commitment status changes since last digest.';

    const prompt = `You are CivicScope, an intelligence analyst tracking Queensland government accountability on youth justice.

Generate a ${period} intelligence briefing for the period ${since.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}.

## NEW MINISTERIAL STATEMENTS (${newStatements?.length || 0})
${statementsContext || 'None'}

## NEW HANSARD SPEECHES (${newHansard?.length || 0})
${hansardContext || 'None'}

## NEW ALERTS (${newAlerts?.length || 0})
${alertsContext || 'None'}

## CHARTER COMMITMENT STATUS (${commitments?.length || 0} youth justice commitments)
${commitmentContext || 'None'}

## STATUS CHANGES SINCE LAST DIGEST
${changesContext}

## TOP QLD FUNDING
${(recentFunding || []).map(f => `- ${f.program_name}: $${((f.amount_dollars || 0) / 1e6).toFixed(1)}M (${f.recipient_name}, ${f.financial_year})`).join('\n') || 'None'}

---

Write a concise, insightful briefing (300-500 words) that:
1. Opens with the most significant development
2. Highlights any GAPS between what ministers promised and what they're doing/funding
3. Notes any contradictions between statements and parliamentary speeches
4. Flags commitment status changes with context
5. Identifies trends (increasing/decreasing attention to youth justice)
6. Ends with 2-3 things to watch next week

Write in a direct, analytical tone. No preamble. Use specific names, dates, and dollar amounts.`;

    // ── Generate the briefing ──
    const { text: summary } = await generateText({
      model: anthropic('claude-sonnet-4-5-20250514'),
      prompt,
      maxTokens: 1000,
    });

    // ── Store the digest ──
    const digestRecord = {
      period_start: since.toISOString().slice(0, 10),
      period_end: now.toISOString().slice(0, 10),
      digest_type: period,
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

    if (!dryRun) {
      const { error: insertErr } = await db.from('civic_digests').insert(digestRecord);
      if (insertErr) {
        return NextResponse.json({ error: `Insert failed: ${insertErr.message}`, summary }, { status: 500 });
      }
    }

    // ── Send Telegram ──
    let telegramSent = false;
    if (sendTelegram && !dryRun && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      try {
        const emoji = statusChanges.length > 0 ? '\u{1F6A8}' : '\u{1F4CB}';
        const tgMsg = `${emoji} <b>CivicScope ${period} Briefing</b>\n<i>${since.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}</i>\n\n${escapeHtml(summary)}\n\n<code>#civicscope #qld</code>`;

        const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text: tgMsg.slice(0, 4096), // Telegram limit
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });
        telegramSent = tgRes.ok;
      } catch { /* Telegram failure shouldn't block digest */ }
    }

    return NextResponse.json({
      digest_type: period,
      period: { start: since.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) },
      summary,
      stats: {
        statements: newStatements?.length || 0,
        hansard: newHansard?.length || 0,
        alerts: newAlerts?.length || 0,
        status_changes: statusChanges.length,
      },
      telegram_sent: telegramSent,
      dry_run: dryRun,
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

#!/usr/bin/env node
/**
 * civic-telegram-alerts.mjs
 *
 * Sends unsent civic_alerts to a Telegram channel/chat.
 * Marks alerts as sent after successful delivery.
 *
 * Env vars:
 *   TELEGRAM_BOT_TOKEN   — from BotFather
 *   TELEGRAM_CHAT_ID     — channel (@channel) or chat ID (-100...)
 *
 * Usage:
 *   node --env-file=.env scripts/civic-telegram-alerts.mjs [--dry-run] [--limit=10]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

const SEVERITY_EMOJI = {
  high: '\u{1F6A8}',      // 🚨
  info: '\u{1F4CB}',      // 📋
  warning: '\u{26A0}\u{FE0F}', // ⚠️
};

const TYPE_EMOJI = {
  program_announcement: '\u{1F4E2}', // 📢
  hansard_mention: '\u{1F3DB}\u{FE0F}', // 🏛️
  commitment_progress: '\u{2705}',    // ✅
  funding_change: '\u{1F4B0}',       // 💰
};

function formatAlert(alert) {
  const emoji = TYPE_EMOJI[alert.alert_type] || SEVERITY_EMOJI[alert.severity] || '\u{1F514}';
  const severity = alert.severity === 'high' ? ' \u{1F534} HIGH' : '';

  let msg = `${emoji}${severity} <b>${escapeHtml(alert.title)}</b>\n\n`;
  msg += `${escapeHtml(alert.summary)}\n\n`;

  // Add linked record counts
  const linked = alert.linked_records || {};
  const parts = [];
  if (linked.funding?.length) parts.push(`${linked.funding.length} funding link(s)`);
  if (linked.interventions?.length) parts.push(`${linked.interventions.length} program(s)`);
  if (linked.statements?.length) parts.push(`${linked.statements.length} statement(s)`);
  if (linked.entities?.length) parts.push(`${linked.entities.length} org(s)`);
  if (parts.length) msg += `\u{1F517} ${parts.join(' \u{00B7} ')}\n`;

  msg += `\n<i>${alert.jurisdiction} \u{00B7} ${new Date(alert.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</i>`;
  msg += `\n<code>#civicscope #${alert.jurisdiction?.toLowerCase() || 'qld'}</code>`;

  return msg;
}

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }

  return res.json();
}

async function run() {
  if (!BOT_TOKEN || !CHAT_ID) {
    log('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Set in .env');
    log('Create a bot: https://t.me/BotFather');
    log('Get chat ID: send a message to the bot, then visit:');
    log(`  https://api.telegram.org/bot<TOKEN>/getUpdates`);
    process.exit(1);
  }

  log(`Starting Telegram Alert Sender (dry_run=${DRY_RUN}, limit=${LIMIT})`);

  // Fetch unsent alerts (no sent_at timestamp)
  const { data: alerts, error } = await db
    .from('civic_alerts')
    .select('*')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(LIMIT);

  if (error) {
    log(`Error fetching alerts: ${error.message}`);
    process.exit(1);
  }

  if (!alerts?.length) {
    log('No unsent alerts.');
    return;
  }

  log(`Found ${alerts.length} unsent alerts`);

  let sent = 0;
  for (const alert of alerts) {
    const msg = formatAlert(alert);

    if (DRY_RUN) {
      log(`[DRY] Would send: ${alert.title}`);
      console.log(msg.replace(/<[^>]+>/g, ''));
      console.log('---');
      continue;
    }

    try {
      await sendTelegram(msg);
      sent++;

      // Mark as sent
      await db
        .from('civic_alerts')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', alert.id);

      log(`Sent: ${alert.title}`);

      // Rate limit: max 1 msg/sec for Telegram
      await new Promise(r => setTimeout(r, 1100));
    } catch (err) {
      log(`ERROR sending alert ${alert.id}: ${err.message}`);
    }
  }

  log(`\nDone. ${sent}/${alerts.length} alerts sent to Telegram.`);
}

run().catch(err => { console.error(err); process.exit(1); });

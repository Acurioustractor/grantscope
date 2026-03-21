import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/cron/usage-alerts
 *
 * Checks API key usage over the last hour and sends Telegram alerts
 * when a key exceeds 80% of its rate limit capacity.
 *
 * Designed to run via Vercel Cron every hour.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceSupabase();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  // Get all active keys with their rate limits
  const { data: keys } = await db
    .from('api_keys')
    .select('id, org_id, name, key_prefix, rate_limit_per_min')
    .is('revoked_at', null);

  if (!keys || keys.length === 0) {
    return NextResponse.json({ checked: 0, alerts: 0 });
  }

  // Get request counts per key in the last hour
  const { data: usage } = await db
    .from('api_usage')
    .select('key_id')
    .in('key_id', keys.map(k => k.id))
    .gte('created_at', oneHourAgo);

  // Count requests per key
  const countByKey = new Map<string, number>();
  for (const row of usage || []) {
    const keyId = row.key_id as string;
    countByKey.set(keyId, (countByKey.get(keyId) || 0) + 1);
  }

  // Check thresholds — alert at 80% of hourly capacity (rate_limit * 60)
  const alerts: { key_name: string; prefix: string; requests: number; hourly_limit: number; pct: number }[] = [];

  for (const key of keys) {
    const hourlyLimit = (key.rate_limit_per_min as number) * 60;
    const requests = countByKey.get(key.id) || 0;
    const pct = (requests / hourlyLimit) * 100;

    if (pct >= 80) {
      alerts.push({
        key_name: key.name as string,
        prefix: key.key_prefix as string,
        requests,
        hourly_limit: hourlyLimit,
        pct: Math.round(pct),
      });
    }
  }

  // Send Telegram alert if any keys are approaching limits
  let telegramSent = false;
  if (alerts.length > 0 && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const lines = alerts.map(a =>
      `• <code>${a.prefix}...</code> (${a.key_name}): ${a.requests.toLocaleString()}/${a.hourly_limit.toLocaleString()} req/hr (${a.pct}%)`
    );

    const msg = [
      `⚠️ <b>API Rate Limit Alert</b>`,
      ``,
      `${alerts.length} key${alerts.length > 1 ? 's' : ''} approaching rate limit:`,
      ...lines,
      ``,
      `<i>${new Date().toISOString().slice(0, 16)}Z</i>`,
    ].join('\n');

    try {
      const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: msg.slice(0, 4096),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      telegramSent = res.ok;
    } catch {
      console.error('[usage-alerts] Telegram send failed');
    }
  }

  return NextResponse.json({
    checked: keys.length,
    alerts: alerts.length,
    telegram_sent: telegramSent,
    details: alerts,
  });
}

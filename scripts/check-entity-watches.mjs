#!/usr/bin/env node
/**
 * Entity Watch Notification Cron
 *
 * Checks all active entity watches for changes since last_checked_at.
 * For each watched entity, looks for:
 *   - New contracts (austender_contracts by supplier_abn)
 *   - New grants (justice_funding by recipient_abn)
 *   - New relationships (gs_relationships by entity UUID)
 *
 * When changes are found, sends email notification via Gmail and
 * updates entity_watches.change_summary + last_checked_at/last_change_at.
 * Logs run to agent_runs table.
 *
 * Usage:
 *   node --env-file=.env scripts/check-entity-watches.mjs [--dry-run]
 *
 * Intended to run daily via cron or scheduler.
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import crypto from 'crypto';

const DRY_RUN = process.argv.includes('--dry-run');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const GOOGLE_DELEGATED_USER = process.env.GOOGLE_DELEGATED_USER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://civicgraph.com.au';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Gmail Send (same pattern as deliver-grant-notifications.mjs) ─────

async function getGoogleAccessToken(credentials, subject, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    sub: subject,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = sign.sign(credentials.private_key, 'base64url');
  const jwt = `${signInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) throw new Error(`Google auth error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function sendEmail({ to, subject, body }) {
  if (!GOOGLE_SERVICE_ACCOUNT_KEY || !GOOGLE_DELEGATED_USER) {
    console.warn('  Gmail not configured — skipping email delivery');
    return { id: null, skipped: true };
  }

  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  const accessToken = await getGoogleAccessToken(credentials, GOOGLE_DELEGATED_USER, [
    'https://www.googleapis.com/auth/gmail.send',
  ]);

  const message = [
    `From: CivicGraph <${GOOGLE_DELEGATED_USER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=utf-8`,
    '',
    body,
  ].join('\r\n');

  const encodedMessage = Buffer.from(message).toString('base64url');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  return { id: data?.id || null };
}

// ─── Email template ───────────────────────────────────────────────────

function buildEmailBody(watch, changes) {
  const lines = [];

  if (changes.new_contracts) {
    lines.push(`${changes.new_contracts} new contract${changes.new_contracts > 1 ? 's' : ''}`);
  }
  if (changes.new_funding) {
    lines.push(`${changes.new_funding} new funding record${changes.new_funding > 1 ? 's' : ''}`);
  }
  if (changes.new_relationships) {
    lines.push(`${changes.new_relationships} new relationship${changes.new_relationships > 1 ? 's' : ''}`);
  }

  const entityName = watch.canonical_name || watch.gs_id;
  const entityUrl = `${APP_URL}/entities/${watch.gs_id}`;
  const watchlistUrl = `${APP_URL}/home/watchlist`;

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
  <div style="border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 24px;">
    <strong style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">CivicGraph</strong>
  </div>

  <h2 style="font-size: 18px; margin: 0 0 8px;">Entity Watch Alert</h2>
  <p style="color: #666; font-size: 14px; margin: 0 0 24px;">
    Changes detected for <strong>${entityName}</strong>
  </p>

  <div style="background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
    <ul style="margin: 0; padding: 0 0 0 18px; font-size: 14px; line-height: 1.8;">
      ${lines.map(l => `<li>${l}</li>`).join('\n      ')}
    </ul>
  </div>

  <a href="${entityUrl}" style="display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
    View Entity
  </a>

  <p style="color: #999; font-size: 12px; margin-top: 32px;">
    You're receiving this because you watch this entity.
    <a href="${watchlistUrl}" style="color: #999;">Manage watches</a>
  </p>
</div>`.trim();
}

// ─── Main ─────────────────────────────────────────────────────────────

const run = await logStart(supabase, 'check-entity-watches', 'Entity Watch Notifications');

try {
  console.log(`=== Entity Watch Notifications ${DRY_RUN ? '(DRY RUN)' : ''} ===`);

  // Fetch all active watches
  const { data: watches, error: watchErr } = await supabase
    .from('entity_watches')
    .select('id, user_id, entity_id, gs_id, canonical_name, watch_types, last_checked_at')
    .order('last_checked_at', { ascending: true, nullsFirst: true });

  if (watchErr) throw new Error(`Failed to fetch watches: ${watchErr.message}`);
  if (!watches || watches.length === 0) {
    console.log('No active watches found.');
    await logComplete(supabase, run.id, { items_found: 0, items_new: 0 });
    process.exit(0);
  }

  console.log(`Checking ${watches.length} entity watches...`);

  // Resolve user emails (batch)
  const userIds = [...new Set(watches.map(w => w.user_id))];
  const emailMap = new Map();
  for (const userId of userIds) {
    const { data } = await supabase.auth.admin.getUserById(userId);
    if (data?.user?.email) {
      emailMap.set(userId, data.user.email);
    }
  }

  let totalChanges = 0;
  let watchesWithChanges = 0;
  let emailsSent = 0;
  let emailsFailed = 0;

  for (const watch of watches) {
    const since = watch.last_checked_at || new Date(Date.now() - 7 * 86400000).toISOString();
    const changes = {};

    // Look up entity ABN for contract/funding queries
    const { data: entity } = await supabase
      .from('gs_entities')
      .select('abn')
      .eq('id', watch.entity_id)
      .single();

    const abn = entity?.abn;

    // Check for new contracts
    if (watch.watch_types?.includes('contracts') && abn) {
      const { count } = await supabase
        .from('austender_contracts')
        .select('id', { count: 'exact', head: true })
        .eq('supplier_abn', abn)
        .gte('created_at', since);

      if (count > 0) {
        changes.new_contracts = count;
        totalChanges += count;
      }
    }

    // Check for new grants/funding
    if (watch.watch_types?.includes('grants') && abn) {
      const { count } = await supabase
        .from('justice_funding')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_abn', abn)
        .gte('created_at', since);

      if (count > 0) {
        changes.new_funding = count;
        totalChanges += count;
      }
    }

    // Check for new relationships
    if (watch.watch_types?.includes('relationships')) {
      const { count: srcCount } = await supabase
        .from('gs_relationships')
        .select('id', { count: 'exact', head: true })
        .eq('source_entity_id', watch.entity_id)
        .gte('created_at', since);

      const { count: tgtCount } = await supabase
        .from('gs_relationships')
        .select('id', { count: 'exact', head: true })
        .eq('target_entity_id', watch.entity_id)
        .gte('created_at', since);

      const relCount = (srcCount || 0) + (tgtCount || 0);
      if (relCount > 0) {
        changes.new_relationships = relCount;
        totalChanges += relCount;
      }
    }

    const now = new Date().toISOString();
    const hasChanges = Object.keys(changes).length > 0;

    if (hasChanges) {
      watchesWithChanges++;
      const entityName = watch.canonical_name || watch.gs_id;
      console.log(`  ${entityName}: ${JSON.stringify(changes)}`);

      // Send email notification
      const email = emailMap.get(watch.user_id);
      if (email) {
        const totalItems = Object.values(changes).reduce((a, b) => a + b, 0);
        const subject = `[CivicGraph] ${totalItems} change${totalItems > 1 ? 's' : ''} for ${entityName}`;
        const body = buildEmailBody(watch, changes);

        if (DRY_RUN) {
          console.log(`    [dry-run] Would email ${email}: ${subject}`);
          emailsSent++;
        } else {
          try {
            await sendEmail({ to: email, subject, body });
            emailsSent++;
            console.log(`    Emailed ${email}`);
          } catch (err) {
            emailsFailed++;
            console.error(`    Email failed for ${email}: ${err.message}`);
          }
        }
      }
    }

    // Update the watch record
    const updatePayload = {
      last_checked_at: new Date().toISOString(),
      ...(hasChanges && {
        last_change_at: new Date().toISOString(),
        change_summary: {
          ...changes,
          checked_since: since,
          checked_at: new Date().toISOString(),
        },
      }),
    };

    await supabase
      .from('entity_watches')
      .update(updatePayload)
      .eq('id', watch.id);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Watches: ${watches.length}, With changes: ${watchesWithChanges}, Total items: ${totalChanges}`);
  console.log(`Emails: ${emailsSent} sent, ${emailsFailed} failed`);

  await logComplete(supabase, run.id, {
    items_found: watches.length,
    items_new: totalChanges,
    items_updated: watchesWithChanges,
  });
} catch (err) {
  console.error('Entity watch check failed:', err);
  await logFailed(supabase, run.id, err);
  process.exit(1);
}

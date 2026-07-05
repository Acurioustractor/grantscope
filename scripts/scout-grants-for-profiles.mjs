#!/usr/bin/env node
/**
 * Grant Scout Agent — Finds new grants matching org profiles and auto-adds to pipeline.
 *
 * For each org_profile with notify_email=true:
 *   1. Score all recent/open grants against the profile
 *   2. Auto-add high-scoring grants to saved_grants (stage=discovered)
 *   3. Update alert_preferences match counts
 *
 * Usage:
 *   npx tsx scripts/scout-grants-for-profiles.mjs [--dry-run] [--user-id=UUID]
 *
 * Run under tsx (not plain node) because it imports the shared TS scorer.
 * Designed to run on schedule (daily via agent_schedules).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { scoreGrantsForOrg } from '../packages/grant-engine/src/grant-matching.ts';
import { assessGrantVerification } from '../packages/grant-engine/src/grant-verification.ts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_USER = process.argv.find(a => a.startsWith('--user-id='))?.split('=')[1];
const MIN_SCORE = 65; // Minimum match score to auto-add to pipeline
const ALERT_MIN_SCORE = 50; // Minimum score to count as alert match

// ─── Alert Matching ─────────────────────────────────────────────────────

function matchesAlert(grant, alert) {
  // Check categories
  if (alert.categories?.length > 0) {
    const grantCats = (grant.categories || []).map(c => c.toLowerCase());
    const alertCats = alert.categories.map(c => c.toLowerCase());
    if (!alertCats.some(ac => grantCats.some(gc => gc.includes(ac) || ac.includes(gc)))) {
      return false;
    }
  }

  // Check states
  if (alert.states?.length > 0) {
    const sourceState = {
      'nsw-grants': 'NSW', 'vic-grants': 'VIC', 'qld-grants': 'QLD',
      'sa-grants': 'SA', 'wa-grants': 'WA', 'tas-grants': 'TAS',
      'act-grants': 'ACT', 'nt-grants': 'NT', 'grantconnect': 'National'
    }[grant.source];
    const alertStates = alert.states.map(s => s.toLowerCase());
    if (sourceState && !alertStates.includes(sourceState.toLowerCase())) {
      return false;
    }
  }

  // Check amount range
  if (alert.min_amount && grant.amount_max && grant.amount_max < alert.min_amount) return false;
  if (alert.max_amount && grant.amount_min && grant.amount_min > alert.max_amount) return false;

  // Check keywords
  if (alert.keywords?.length > 0) {
    const text = `${grant.name} ${grant.description || ''}`.toLowerCase();
    if (!alert.keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return false;
    }
  }

  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const run = await logStart(supabase, 'scout-grants-for-profiles', 'Grant Scout');

  try {
    // 1. Get active org profiles
    let profileQuery = supabase
      .from('org_profiles')
      .select('id, user_id, name, domains, geographic_focus, org_type, annual_revenue, mission, projects, notify_email, notify_threshold, embedding');

    if (SPECIFIC_USER) {
      profileQuery = profileQuery.eq('user_id', SPECIFIC_USER);
    } else {
      profileQuery = profileQuery.eq('notify_email', true);
    }

    const { data: profiles, error: profileError } = await profileQuery;
    if (profileError) throw profileError;
    if (!profiles?.length) {
      console.log('No active profiles to scout for.');
      await logComplete(supabase, run.id, { items_found: 0, items_new: 0 });
      return;
    }
    console.log(`Scouting for ${profiles.length} org profile(s)...`);

    let totalAdded = 0;
    let totalMatches = 0;
    let fallbackProfiles = 0; // profiles scored via keyword fallback (no embedding)

    for (const profile of profiles) {
      console.log(`\n─── ${profile.name} ───`);

      // 3. Score grants via the shared vector scorer (semantic + learning boosts).
      //    Falls back to keyword heuristics only when the profile has no embedding.
      const { matches, usedFallback } = await scoreGrantsForOrg(supabase, {
        embedding: profile.embedding ?? null,
        domains: profile.domains,
        geo: profile.geographic_focus,
        orgType: profile.org_type,
        annualRevenue: profile.annual_revenue,
        mission: profile.mission,
        userId: profile.user_id,
        threshold: 0.45,
        limit: 300,
      });
      if (usedFallback) {
        fallbackProfiles++;
        console.log(`  ⚠ no embedding — used keyword fallback (save profile to enable semantic matching)`);
      }

      // Enrich candidates with fields the vector RPC does not return
      // (source, amount_min, deadline, target_recipients) for alert matching +
      // notifications, plus the trust fields (sources, url, last_verified_at)
      // used to quarantine unconfirmed grants.
      const candidates = matches.filter(g => g.fit_score >= ALERT_MIN_SCORE);
      const enrichMap = new Map();
      if (candidates.length > 0) {
        const { data: fullRows } = await supabase
          .from('grant_opportunities')
          .select('id, amount_min, deadline, source, target_recipients, aligned_projects, sources, url, last_verified_at')
          .in('id', candidates.map(g => g.id));
        for (const row of fullRows || []) enrichMap.set(row.id, row);
      }

      const scored = candidates.map(g => {
        const extra = enrichMap.get(g.id) || {};
        const verification = assessGrantVerification({
          sources: extra.sources ?? null,
          url: extra.url ?? g.url ?? null,
          last_verified_at: extra.last_verified_at ?? null,
          source: extra.source ?? null,
        });
        return {
          ...g,
          match_score: g.fit_score,
          deadline: extra.deadline ?? g.closes_at ?? null,
          amount_min: extra.amount_min ?? null,
          source: extra.source ?? null,
          target_recipients: extra.target_recipients ?? null,
          aligned_projects: extra.aligned_projects ?? null,
          is_confirmed: verification.isConfirmed,
        };
      });

      const alertMatches = scored;
      // Trust gate: never auto-add or email unconfirmed (llm_knowledge / no verified URL)
      // grants. They remain browsable in the UI, badged "unconfirmed".
      const eligible = scored.filter(g => g.match_score >= MIN_SCORE);
      const highScoring = eligible.filter(g => g.is_confirmed);
      const quarantined = eligible.length - highScoring.length;
      if (quarantined > 0) console.log(`  ⚠ ${quarantined} high-scoring grant(s) held back as unconfirmed (not verified)`);

      console.log(`  ${highScoring.length} grants scored >= ${MIN_SCORE} (of ${matches.length} candidates)`);
      console.log(`  Top 5:`);
      scored.slice(0, 5).forEach(g => {
        console.log(`    ${g.match_score}% — ${g.name?.slice(0, 60)} [${g.match_signals.join(', ')}]`);
      });

      // 4. Check which grants are already in tracker
      const { data: existing } = await supabase
        .from('saved_grants')
        .select('grant_id')
        .eq('user_id', profile.user_id);

      const existingIds = new Set((existing || []).map(e => e.grant_id));
      const newGrants = highScoring.filter(g => !existingIds.has(g.id));
      console.log(`  ${newGrants.length} new grants to add (${existingIds.size} already tracked)`);

      if (!DRY_RUN && newGrants.length > 0) {
        // 5. Auto-add to tracker
        const rows = newGrants.map(g => ({
          user_id: profile.user_id,
          grant_id: g.id,
          stage: 'discovered',
          notes: `Auto-discovered by Grant Scout. Score: ${g.match_score}%. Signals: ${g.match_signals.join(', ')}`,
        }));

        const { error: insertError } = await supabase
          .from('saved_grants')
          .upsert(rows, { onConflict: 'user_id,grant_id' });

        if (insertError) {
          console.error(`  Error adding grants:`, insertError.message);
        } else {
          totalAdded += newGrants.length;
          console.log(`  ✓ Added ${newGrants.length} grants to tracker`);
        }

        // 5b. Queue grant notifications for high-match grants
        if (profile.notify_email) {
          const notifyThreshold = profile.notify_threshold || MIN_SCORE;
          const notifiable = newGrants.filter(g => g.match_score >= notifyThreshold);
          if (notifiable.length > 0) {
            const outboxRows = notifiable.map(g => ({
              user_id: profile.user_id,
              org_profile_id: profile.id,
              grant_id: g.id,
              notification_type: 'grant_match',
              subject: `New grant match: ${g.name?.slice(0, 80)}`,
              body: [
                `Grant: ${g.name}`,
                `Match score: ${g.match_score}%`,
                `Signals: ${g.match_signals.join(', ')}`,
                g.deadline ? `Deadline: ${g.deadline}` : null,
                g.url ? `\nMore info: ${g.url}` : null,
                '',
                'View in CivicGraph: https://civicgraph.au/grants',
              ].filter(Boolean).join('\n'),
              match_score: g.match_score,
              match_signals: g.match_signals,
            }));

            const { error: outboxError } = await supabase
              .from('grant_notification_outbox')
              .upsert(outboxRows, { onConflict: 'user_id,grant_id,notification_type', ignoreDuplicates: true });

            if (outboxError) {
              console.error(`  Error queuing notifications:`, outboxError.message);
            } else {
              console.log(`  ✓ Queued ${notifiable.length} grant notifications`);
            }
          }
        }
      }

      // 6. Update alert match counts
      if (!DRY_RUN) {
        const { data: alerts } = await supabase
          .from('alert_preferences')
          .select('id, categories, states, min_amount, max_amount, keywords, focus_areas')
          .eq('user_id', profile.user_id)
          .eq('enabled', true);

        if (alerts?.length) {
          for (const alert of alerts) {
            const matches = alertMatches.filter(g => matchesAlert(g, alert));
            if (matches.length > 0) {
              await supabase
                .from('alert_preferences')
                .update({
                  match_count: matches.length,
                  last_matched_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', alert.id);
            }
          }
          console.log(`  ✓ Updated ${alerts.length} alert(s)`);
        }
      }

      totalMatches += alertMatches.length;
    }

    console.log(`\n═══ Summary ═══`);
    console.log(`Profiles scanned: ${profiles.length}`);
    console.log(`Semantic matching: ${profiles.length - fallbackProfiles}/${profiles.length} (${fallbackProfiles} keyword fallback)`);
    console.log(`Total matches (>= ${ALERT_MIN_SCORE}): ${totalMatches}`);
    console.log(`Grants added to pipelines: ${totalAdded}`);
    if (DRY_RUN) console.log('(DRY RUN — no changes made)');

    await logComplete(supabase, run.id, {
      items_found: totalMatches,
      items_new: totalAdded,
      items_updated: profiles.length,
    });

  } catch (err) {
    console.error('Grant Scout failed:', err);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

main();

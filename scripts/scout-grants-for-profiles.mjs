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
 *   node --env-file=.env scripts/scout-grants-for-profiles.mjs [--dry-run] [--user-id=UUID]
 *
 * Designed to run on schedule (daily via agent_schedules).
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_USER = process.argv.find(a => a.startsWith('--user-id='))?.split('=')[1];
const MIN_SCORE = 65; // Minimum match score to auto-add to pipeline
const ALERT_MIN_SCORE = 50; // Minimum score to count as alert match

// ─── Scoring Logic (mirrors /api/grants/match) ──────────────────────────

function scoreGrant(grant, profile) {
  let score = 50;
  const signals = [];

  // Category match
  const orgDomains = (profile.domains || []).map(d => d.toLowerCase());
  const grantCategories = (grant.categories || []).map(c => c.toLowerCase());
  const grantFocusAreas = (grant.focus_areas || []).map(f => f.toLowerCase());
  const allGrantTerms = [...grantCategories, ...grantFocusAreas];

  const categoryOverlap = orgDomains.filter(d =>
    allGrantTerms.some(t => t.includes(d) || d.includes(t))
  ).length;

  if (categoryOverlap > 0) {
    score += Math.min(categoryOverlap * 10, 25);
    signals.push(`${categoryOverlap} category match${categoryOverlap > 1 ? 'es' : ''}`);
  }

  // Geographic match
  const orgGeo = (profile.geographic_focus || []).map(g => g.toLowerCase());
  const grantGeo = (grant.geography || '').toLowerCase();

  if (orgGeo.length > 0 && grantGeo) {
    const geoMatch = orgGeo.some(g => grantGeo.includes(g) || g.includes(grantGeo));
    if (geoMatch) {
      score += 15;
      signals.push('Geographic match');
    }
  }

  // State match (from grant source)
  const sourceState = {
    'nsw-grants': 'nsw', 'vic-grants': 'vic', 'qld-grants': 'qld',
    'sa-grants': 'sa', 'wa-grants': 'wa', 'tas-grants': 'tas',
    'act-grants': 'act', 'nt-grants': 'nt', 'grantconnect': 'national'
  }[grant.source];
  if (sourceState && orgGeo.some(g => g === sourceState || g === 'national')) {
    score += 10;
    signals.push(`State match (${sourceState.toUpperCase()})`);
  }

  // Amount fit
  if (profile.annual_revenue && grant.amount_max) {
    const ratio = grant.amount_max / profile.annual_revenue;
    if (ratio >= 0.01 && ratio <= 0.5) {
      score += 10;
      signals.push('Amount fits org size');
    }
  }

  // Target recipient match
  const orgType = (profile.org_type || '').toLowerCase();
  const grantTargets = (grant.target_recipients || []).map(t => t.toLowerCase());
  if (grantTargets.length > 0 && orgType) {
    const recipientMatch = grantTargets.some(t =>
      t.includes(orgType) || orgType.includes(t) ||
      (orgType.includes('charity') && t.includes('not-for-profit')) ||
      (orgType.includes('social_enterprise') && t.includes('not-for-profit'))
    );
    if (recipientMatch) {
      score += 10;
      signals.push('Target recipient match');
    }
  }

  // Mission keyword match
  if (profile.mission && grant.description) {
    const missionWords = profile.mission.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const descLower = grant.description.toLowerCase();
    const missionHits = missionWords.filter(w => descLower.includes(w)).length;
    if (missionHits >= 3) {
      score += Math.min(missionHits * 3, 15);
      signals.push(`${missionHits} mission keywords`);
    }
  }

  // Deadline urgency bonus
  if (grant.deadline) {
    const daysUntil = Math.ceil((new Date(grant.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 30) {
      score += 5;
      signals.push('Closing soon');
    }
  }

  // Project alignment (check aligned_projects against profile projects)
  if (profile.projects && grant.aligned_projects?.length > 0) {
    const projectNames = profile.projects.map(p => p.name?.toLowerCase()).filter(Boolean);
    const grantProjects = grant.aligned_projects.map(p => p.toLowerCase());
    const projectMatch = projectNames.some(p => grantProjects.some(gp => gp.includes(p) || p.includes(gp)));
    if (projectMatch) {
      score += 10;
      signals.push('Project alignment');
    }
  }

  return { score: Math.min(score, 100), signals };
}

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
      .select('id, user_id, name, domains, geographic_focus, org_type, annual_revenue, mission, projects, notify_email, notify_threshold');

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

    // 2. Get open grants (deadline in future or no deadline)
    const now = new Date().toISOString().split('T')[0];
    const { data: grants, error: grantError } = await supabase
      .from('grant_opportunities')
      .select('id, name, description, amount_min, amount_max, deadline, provider, url, categories, focus_areas, target_recipients, geography, source, aligned_projects')
      .or(`deadline.is.null,deadline.gte.${now}`)
      .order('created_at', { ascending: false })
      .limit(500);

    if (grantError) throw grantError;
    console.log(`${grants?.length || 0} open grants to score.`);

    let totalAdded = 0;
    let totalMatches = 0;

    for (const profile of profiles) {
      console.log(`\n─── ${profile.name} ───`);

      // 3. Score all grants
      const scored = grants.map(grant => {
        const { score, signals } = scoreGrant(grant, profile);
        return { ...grant, match_score: score, match_signals: signals };
      }).sort((a, b) => b.match_score - a.match_score);

      const highScoring = scored.filter(g => g.match_score >= MIN_SCORE);
      const alertMatches = scored.filter(g => g.match_score >= ALERT_MIN_SCORE);

      console.log(`  ${highScoring.length} grants scored >= ${MIN_SCORE} (of ${scored.length} total)`);
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

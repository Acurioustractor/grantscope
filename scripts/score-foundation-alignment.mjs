#!/usr/bin/env node
/**
 * Foundation Alignment Agent — Scores and saves foundations by alignment with org profiles.
 *
 * For each org_profile:
 *   1. Score all foundations by thematic + geographic + recipient alignment
 *   2. Auto-save top-scoring foundations to saved_foundations
 *   3. Generate alignment reasons for each
 *
 * Usage:
 *   node --env-file=.env scripts/score-foundation-alignment.mjs [--dry-run] [--user-id=UUID] [--limit=50]
 *
 * Designed to run on schedule (weekly via agent_schedules).
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_USER = process.argv.find(a => a.startsWith('--user-id='))?.split('=')[1];
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '30');
const MIN_ALIGNMENT = 50; // Minimum score to auto-save

// ─── Scoring ────────────────────────────────────────────────────────────

function scoreFoundation(foundation, profile) {
  let score = 0;
  const reasons = [];

  const orgDomains = (profile.domains || []).map(d => d.toLowerCase());
  const fThematic = (foundation.thematic_focus || []).map(t => t.toLowerCase());
  const fGeo = (foundation.geographic_focus || []).map(g => g.toLowerCase());
  const fRecipients = (foundation.target_recipients || []).map(r => r.toLowerCase());
  const orgGeo = (profile.geographic_focus || []).map(g => g.toLowerCase());
  const orgType = (profile.org_type || '').toLowerCase();

  // Thematic overlap (up to 40 points)
  const thematicOverlap = orgDomains.filter(d =>
    fThematic.some(t => t.includes(d) || d.includes(t))
  );
  if (thematicOverlap.length > 0) {
    score += Math.min(thematicOverlap.length * 10, 40);
    reasons.push(`Thematic: ${thematicOverlap.join(', ')}`);
  }

  // Geographic overlap (up to 20 points)
  const geoOverlap = orgGeo.filter(g =>
    fGeo.some(fg => {
      const gLow = g.toLowerCase();
      const fgLow = fg.toLowerCase();
      return fgLow.includes(gLow) || gLow.includes(fgLow) ||
        (fgLow.includes('national') && gLow !== 'international') ||
        (fgLow.includes(`au-${gLow}`));
    })
  );
  if (geoOverlap.length > 0) {
    score += Math.min(geoOverlap.length * 10, 20);
    reasons.push(`Geography: ${geoOverlap.join(', ')}`);
  }

  // Recipient type match (10 points)
  if (fRecipients.length > 0 && orgType) {
    const recipientMatch = fRecipients.some(r =>
      r.includes(orgType) || orgType.includes(r) ||
      (orgType.includes('charity') && r.includes('not-for-profit')) ||
      (orgType.includes('social_enterprise') && (r.includes('social') || r.includes('enterprise') || r.includes('not-for-profit')))
    );
    if (recipientMatch) {
      score += 10;
      reasons.push('Recipient type match');
    }
  }

  // Giving size (favor active givers, up to 15 points)
  if (foundation.total_giving_annual) {
    if (foundation.total_giving_annual >= 10_000_000) {
      score += 15;
      reasons.push(`Major giver ($${(foundation.total_giving_annual / 1e6).toFixed(0)}M/yr)`);
    } else if (foundation.total_giving_annual >= 1_000_000) {
      score += 10;
      reasons.push(`Active giver ($${(foundation.total_giving_annual / 1e6).toFixed(1)}M/yr)`);
    } else if (foundation.total_giving_annual >= 100_000) {
      score += 5;
      reasons.push(`Emerging giver ($${(foundation.total_giving_annual / 1e3).toFixed(0)}K/yr)`);
    }
  }

  // Open programs bonus (5 points)
  if (foundation.open_programs && Object.keys(foundation.open_programs).length > 0) {
    score += 5;
    reasons.push('Has open programs');
  }

  // Profile quality bonus (5 points for confident profiles)
  if (foundation.profile_confidence === 'high') {
    score += 5;
    reasons.push('High-confidence profile');
  }

  // Mission keyword match (up to 10 points)
  if (profile.mission && foundation.description) {
    const missionWords = profile.mission.toLowerCase().split(/\s+/).filter(w => w.length > 5);
    const descLower = foundation.description.toLowerCase();
    const hits = missionWords.filter(w => descLower.includes(w)).length;
    if (hits >= 3) {
      score += Math.min(hits * 2, 10);
      reasons.push(`${hits} mission keywords`);
    }
  }

  return { score: Math.min(score, 100), reasons };
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const run = await logStart(supabase, 'score-foundation-alignment', 'Foundation Alignment');

  try {
    // 1. Get active org profiles
    let profileQuery = supabase
      .from('org_profiles')
      .select('id, user_id, name, domains, geographic_focus, org_type, annual_revenue, mission, projects');

    if (SPECIFIC_USER) {
      profileQuery = profileQuery.eq('user_id', SPECIFIC_USER);
    } else {
      profileQuery = profileQuery.eq('notify_email', true);
    }

    const { data: profiles, error: profileError } = await profileQuery;
    if (profileError) throw profileError;
    if (!profiles?.length) {
      console.log('No active profiles to score foundations for.');
      await logComplete(supabase, run.id, { items_found: 0, items_new: 0 });
      return;
    }

    // 2. Get foundations with meaningful data
    const { data: foundations, error: fError } = await supabase
      .from('foundations')
      .select('id, name, acnc_abn, type, website, description, total_giving_annual, thematic_focus, geographic_focus, target_recipients, open_programs, profile_confidence')
      .not('thematic_focus', 'is', null)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(2000);

    if (fError) throw fError;
    console.log(`${foundations?.length || 0} foundations to score.`);

    let totalSaved = 0;

    for (const profile of profiles) {
      console.log(`\n─── ${profile.name} ───`);

      // 3. Score all foundations
      const scored = foundations.map(f => {
        const { score, reasons } = scoreFoundation(f, profile);
        return { ...f, alignment_score: score, alignment_reasons: reasons };
      }).sort((a, b) => b.alignment_score - a.alignment_score);

      const topMatches = scored.filter(f => f.alignment_score >= MIN_ALIGNMENT).slice(0, LIMIT);
      console.log(`  ${topMatches.length} foundations scored >= ${MIN_ALIGNMENT}`);

      // Show top 10
      console.log(`  Top 10:`);
      scored.slice(0, 10).forEach(f => {
        const giving = f.total_giving_annual ? `$${(f.total_giving_annual / 1e6).toFixed(1)}M` : 'N/A';
        console.log(`    ${f.alignment_score}% — ${f.name?.slice(0, 50)} (${giving}) [${f.alignment_reasons.join(', ')}]`);
      });

      if (!DRY_RUN && topMatches.length > 0) {
        // 4. Check existing saved foundations
        const { data: existing } = await supabase
          .from('saved_foundations')
          .select('foundation_id')
          .eq('user_id', profile.user_id);

        const existingIds = new Set((existing || []).map(e => e.foundation_id));
        const newFoundations = topMatches.filter(f => !existingIds.has(f.id));

        if (newFoundations.length > 0) {
          const rows = newFoundations.map(f => ({
            user_id: profile.user_id,
            foundation_id: f.id,
            stage: 'discovered',
            alignment_score: f.alignment_score,
            alignment_reasons: f.alignment_reasons,
            notes: `Auto-discovered by Foundation Alignment Agent. Score: ${f.alignment_score}%.`,
          }));

          const { error: insertError } = await supabase
            .from('saved_foundations')
            .upsert(rows, { onConflict: 'user_id,foundation_id' });

          if (insertError) {
            console.error(`  Error saving foundations:`, insertError.message);
          } else {
            totalSaved += newFoundations.length;
            console.log(`  ✓ Saved ${newFoundations.length} new foundations (${existingIds.size} already saved)`);
          }
        } else {
          console.log(`  All top foundations already saved.`);
        }

        // 5. Update scores for existing saved foundations
        for (const f of topMatches.filter(f => existingIds.has(f.id))) {
          await supabase
            .from('saved_foundations')
            .update({
              alignment_score: f.alignment_score,
              alignment_reasons: f.alignment_reasons,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', profile.user_id)
            .eq('foundation_id', f.id);
        }
      }
    }

    console.log(`\n═══ Summary ═══`);
    console.log(`Profiles scanned: ${profiles.length}`);
    console.log(`Foundations scored: ${foundations.length}`);
    console.log(`New foundations saved: ${totalSaved}`);
    if (DRY_RUN) console.log('(DRY RUN — no changes made)');

    await logComplete(supabase, run.id, {
      items_found: foundations.length,
      items_new: totalSaved,
      items_updated: profiles.length,
    });

  } catch (err) {
    console.error('Foundation Alignment failed:', err);
    await logFailed(supabase, run.id, err);
    process.exit(1);
  }
}

main();

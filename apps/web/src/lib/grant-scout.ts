import { getServiceSupabase } from '@/lib/supabase';
import { recordAlertEvents } from '@/lib/alert-events';

const MIN_SCORE = 65;
const ALERT_MIN_SCORE = 50;

type OrgProfile = {
  id: string;
  user_id: string;
  name: string | null;
  domains: string[] | null;
  geographic_focus: string[] | null;
  org_type: string | null;
  annual_revenue: number | string | null;
  mission: string | null;
  projects: Array<{ name?: string | null }> | null;
  notify_email: boolean | null;
  notify_threshold: number | string | null;
};

type AlertPreference = {
  id: number;
  name: string;
  categories: string[] | null;
  focus_areas: string[] | null;
  states: string[] | null;
  min_amount: number | null;
  max_amount: number | null;
  keywords: string[] | null;
};

type GrantOpportunity = {
  id: string;
  name: string | null;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  provider: string | null;
  url: string | null;
  categories: string[] | null;
  focus_areas: string[] | null;
  target_recipients: string[] | null;
  geography: string | null;
  source: string | null;
  aligned_projects: string[] | null;
};

type ScoutGrant = GrantOpportunity & {
  match_score: number;
  match_signals: string[];
};

export type GrantScoutResult = {
  profilesScanned: number;
  grantsScored: number;
  matchesFound: number;
  grantsAdded: number;
  notificationsQueued: number;
  alertsUpdated: number;
};

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeThreshold(value: number | string | null | undefined) {
  const parsed = typeof value === 'string' ? Number(value) : value ?? NaN;
  if (!Number.isFinite(parsed)) return MIN_SCORE;
  return parsed <= 1 ? Math.round(parsed * 100) : parsed;
}

function scoreGrant(grant: GrantOpportunity, profile: OrgProfile) {
  let score = 50;
  const signals: string[] = [];

  const orgDomains = toArray(profile.domains).map((domain) => domain.toLowerCase());
  const grantCategories = toArray(grant.categories).map((category) => category.toLowerCase());
  const grantFocusAreas = toArray(grant.focus_areas).map((focusArea) => focusArea.toLowerCase());
  const allGrantTerms = [...grantCategories, ...grantFocusAreas];

  const categoryOverlap = orgDomains.filter((domain) =>
    allGrantTerms.some((term) => term.includes(domain) || domain.includes(term))
  ).length;

  if (categoryOverlap > 0) {
    score += Math.min(categoryOverlap * 10, 25);
    signals.push(`${categoryOverlap} category match${categoryOverlap > 1 ? 'es' : ''}`);
  }

  const orgGeo = toArray(profile.geographic_focus).map((geo) => geo.toLowerCase());
  const grantGeo = (grant.geography || '').toLowerCase();
  if (orgGeo.length > 0 && grantGeo) {
    const geoMatch = orgGeo.some((geo) => grantGeo.includes(geo) || geo.includes(grantGeo));
    if (geoMatch) {
      score += 15;
      signals.push('Geographic match');
    }
  }

  const sourceState = {
    'nsw-grants': 'nsw',
    'vic-grants': 'vic',
    'qld-grants': 'qld',
    'sa-grants': 'sa',
    'wa-grants': 'wa',
    'tas-grants': 'tas',
    'act-grants': 'act',
    'nt-grants': 'nt',
    grantconnect: 'national',
  }[grant.source || ''];

  if (sourceState && orgGeo.some((geo) => geo === sourceState || geo === 'national')) {
    score += 10;
    signals.push(`State match (${sourceState.toUpperCase()})`);
  }

  const annualRevenue = Number(profile.annual_revenue || 0);
  if (annualRevenue > 0 && grant.amount_max) {
    const ratio = grant.amount_max / annualRevenue;
    if (ratio >= 0.01 && ratio <= 0.5) {
      score += 10;
      signals.push('Amount fits org size');
    }
  }

  const orgType = (profile.org_type || '').toLowerCase();
  const grantTargets = toArray(grant.target_recipients).map((target) => target.toLowerCase());
  if (grantTargets.length > 0 && orgType) {
    const recipientMatch = grantTargets.some((target) =>
      target.includes(orgType)
      || orgType.includes(target)
      || (orgType.includes('charity') && target.includes('not-for-profit'))
      || (orgType.includes('social_enterprise') && target.includes('not-for-profit'))
    );
    if (recipientMatch) {
      score += 10;
      signals.push('Target recipient match');
    }
  }

  if (profile.mission && grant.description) {
    const missionWords = profile.mission.toLowerCase().split(/\s+/).filter((word) => word.length > 4);
    const description = grant.description.toLowerCase();
    const missionHits = missionWords.filter((word) => description.includes(word)).length;
    if (missionHits >= 3) {
      score += Math.min(missionHits * 3, 15);
      signals.push(`${missionHits} mission keywords`);
    }
  }

  if (grant.deadline) {
    const daysUntilDeadline = Math.ceil((new Date(grant.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDeadline > 0 && daysUntilDeadline <= 30) {
      score += 5;
      signals.push('Closing soon');
    }
  }

  const profileProjects = Array.isArray(profile.projects) ? profile.projects : [];
  if (profileProjects.length > 0 && Array.isArray(grant.aligned_projects) && grant.aligned_projects.length > 0) {
    const projectNames = profileProjects
      .map((project) => project?.name?.toLowerCase())
      .filter((name): name is string => Boolean(name));
    const grantProjects = grant.aligned_projects.map((project) => project.toLowerCase());
    const projectMatch = projectNames.some((projectName) =>
      grantProjects.some((grantProject) => grantProject.includes(projectName) || projectName.includes(grantProject))
    );
    if (projectMatch) {
      score += 10;
      signals.push('Project alignment');
    }
  }

  return { score: Math.min(score, 100), signals };
}

function matchesAlert(grant: GrantOpportunity, alert: AlertPreference) {
  const alertTerms = [...toArray(alert.categories), ...toArray(alert.focus_areas)];
  if (alertTerms.length > 0) {
    const grantTerms = [...toArray(grant.categories), ...toArray(grant.focus_areas)].map((term) => term.toLowerCase());
    const normalizedAlertTerms = alertTerms.map((term) => term.toLowerCase());
    if (!normalizedAlertTerms.some((alertTerm) =>
      grantTerms.some((grantTerm) => grantTerm.includes(alertTerm) || alertTerm.includes(grantTerm))
    )) {
      return false;
    }
  }

  if (toArray(alert.states).length > 0) {
    const sourceState = {
      'nsw-grants': 'NSW',
      'vic-grants': 'VIC',
      'qld-grants': 'QLD',
      'sa-grants': 'SA',
      'wa-grants': 'WA',
      'tas-grants': 'TAS',
      'act-grants': 'ACT',
      'nt-grants': 'NT',
      grantconnect: 'National',
    }[grant.source || ''];

    if (sourceState) {
      const alertStates = toArray(alert.states).map((state) => state.toLowerCase());
      if (!alertStates.includes(sourceState.toLowerCase())) {
        return false;
      }
    }
  }

  if (alert.min_amount && grant.amount_max && grant.amount_max < alert.min_amount) return false;
  if (alert.max_amount && grant.amount_min && grant.amount_min > alert.max_amount) return false;

  if (toArray(alert.keywords).length > 0) {
    const text = `${grant.name || ''} ${grant.description || ''}`.toLowerCase();
    if (!toArray(alert.keywords).some((keyword) => text.includes(keyword.toLowerCase()))) {
      return false;
    }
  }

  return true;
}

function alertSpecificity(alert: AlertPreference) {
  return toArray(alert.categories).length
    + toArray(alert.focus_areas).length
    + toArray(alert.states).length
    + toArray(alert.keywords).length
    + (alert.min_amount ? 1 : 0)
    + (alert.max_amount ? 1 : 0);
}

function findMatchingAlert(grant: GrantOpportunity, alerts: AlertPreference[]) {
  return alerts.find((alert) => matchesAlert(grant, alert)) || null;
}

export async function runGrantScoutForUser(userId: string): Promise<GrantScoutResult> {
  const db = getServiceSupabase();

  const { data: profiles, error: profileError } = await db
    .from('org_profiles')
    .select('id, user_id, name, domains, geographic_focus, org_type, annual_revenue, mission, projects, notify_email, notify_threshold')
    .eq('user_id', userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profiles?.length) {
    return {
      profilesScanned: 0,
      grantsScored: 0,
      matchesFound: 0,
      grantsAdded: 0,
      notificationsQueued: 0,
      alertsUpdated: 0,
    };
  }

  const now = new Date().toISOString().split('T')[0];
  const { data: grants, error: grantError } = await db
    .from('grant_opportunities')
    .select('id, name, description, amount_min, amount_max, deadline, provider, url, categories, focus_areas, target_recipients, geography, source, aligned_projects')
    .or(`deadline.is.null,deadline.gte.${now}`)
    .order('created_at', { ascending: false })
    .limit(500);

  if (grantError) {
    throw new Error(grantError.message);
  }

  let totalAdded = 0;
  let totalMatches = 0;
  let totalQueued = 0;
  let totalAlertsUpdated = 0;

  for (const profile of profiles as OrgProfile[]) {
    const { data: alerts, error: alertsError } = await db
      .from('alert_preferences')
      .select('id, name, categories, focus_areas, states, min_amount, max_amount, keywords')
      .eq('user_id', profile.user_id)
      .eq('enabled', true);

    if (alertsError) {
      throw new Error(alertsError.message);
    }

    const enabledAlerts = [...((alerts || []) as AlertPreference[])].sort((a, b) => alertSpecificity(b) - alertSpecificity(a));

    const scored = ((grants || []) as GrantOpportunity[])
      .map((grant) => {
        const { score, signals } = scoreGrant(grant, profile);
        return { ...grant, match_score: score, match_signals: signals };
      })
      .sort((a, b) => b.match_score - a.match_score);

    const highScoring = scored.filter((grant) => grant.match_score >= MIN_SCORE);
    const alertMatches = scored.filter((grant) => grant.match_score >= ALERT_MIN_SCORE);
    totalMatches += alertMatches.length;

    const { data: existingSavedGrants, error: existingError } = await db
      .from('saved_grants')
      .select('grant_id')
      .eq('user_id', profile.user_id);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingIds = new Set((existingSavedGrants || []).map((row: { grant_id: string }) => row.grant_id));
    const newGrants = highScoring.filter((grant) => !existingIds.has(grant.id));
    const matchedAlertsByGrantId = new Map(
      newGrants.map((grant) => [grant.id, findMatchingAlert(grant, enabledAlerts)])
    );

    if (newGrants.length > 0) {
      const attributedAt = new Date().toISOString();
      const rows = newGrants.map((grant) => {
        const matchedAlert = matchedAlertsByGrantId.get(grant.id);
        return {
          user_id: profile.user_id,
          org_profile_id: profile.id,
          grant_id: grant.id,
          stage: 'discovered',
          notes: `Auto-discovered by Grant Scout. Score: ${grant.match_score}%. Signals: ${grant.match_signals.join(', ')}`,
          source_alert_preference_id: matchedAlert?.id ?? null,
          source_notification_id: null,
          source_attribution_type: 'scout_auto' as const,
          source_attributed_at: attributedAt,
        };
      });

      const { error: insertError } = await db
        .from('saved_grants')
        .upsert(rows, { onConflict: 'user_id,grant_id' });

      if (insertError) {
        throw new Error(insertError.message);
      }

      totalAdded += newGrants.length;
    }

    const notifyThreshold = normalizeThreshold(profile.notify_threshold);
    const shouldQueueNotifications = profile.notify_email !== false || enabledAlerts.length > 0;
    const notifiable = shouldQueueNotifications
      ? newGrants.filter((grant) => grant.match_score >= notifyThreshold)
      : [];

    if (notifiable.length > 0) {
      const grantIds = notifiable.map((grant) => grant.id);
      const { data: existingNotifications, error: existingNotificationsError } = await db
        .from('grant_notification_outbox')
        .select('grant_id')
        .eq('user_id', profile.user_id)
        .eq('notification_type', 'grant_match')
        .in('status', ['queued', 'sent'])
        .in('grant_id', grantIds);

      if (existingNotificationsError) {
        throw new Error(existingNotificationsError.message);
      }

      const notifiedGrantIds = new Set((existingNotifications || []).map((row: { grant_id: string }) => row.grant_id));
      const rowsToInsert = notifiable
        .filter((grant) => !notifiedGrantIds.has(grant.id))
        .map((grant) => ({
          alert_preference_id: matchedAlertsByGrantId.get(grant.id)?.id || null,
          user_id: profile.user_id,
          org_profile_id: profile.id,
          grant_id: grant.id,
          notification_type: 'grant_match',
          subject: `New grant match: ${(grant.name || '').slice(0, 80)}`,
          body: [
            `Grant: ${grant.name || 'Untitled grant'}`,
            `Match score: ${grant.match_score}%`,
            `Signals: ${grant.match_signals.join(', ')}`,
            grant.deadline ? `Deadline: ${grant.deadline}` : null,
            grant.url ? `\nMore info: ${grant.url}` : null,
            '',
            'View in CivicGraph: https://civicgraph.au/grants',
          ].filter(Boolean).join('\n'),
          match_score: grant.match_score,
          match_signals: grant.match_signals,
        }));

      if (rowsToInsert.length > 0) {
        const { data: insertedNotifications, error: notificationError } = await db
          .from('grant_notification_outbox')
          .insert(rowsToInsert)
          .select('id, alert_preference_id, grant_id');

        if (notificationError) {
          throw new Error(notificationError.message);
        }

        totalQueued += rowsToInsert.length;

        await recordAlertEvents([
          ...((insertedNotifications || []).map((notification: { id: string; alert_preference_id: number | null; grant_id: string }) => ({
            userId: profile.user_id,
            alertPreferenceId: notification.alert_preference_id,
            notificationId: notification.id,
            grantId: notification.grant_id,
            eventType: 'notification_queued' as const,
            metadata: {
              source: 'grant_scout',
            },
          }))),
        ]);
      }
    }

    if (enabledAlerts.length > 0) {
      const timestamp = new Date().toISOString();
      for (const alert of enabledAlerts) {
        const matches = alertMatches.filter((grant) => matchesAlert(grant, alert));
        const { error: updateError } = await db
          .from('alert_preferences')
          .update({
            match_count: matches.length,
            last_matched_at: matches.length > 0 ? timestamp : null,
            updated_at: timestamp,
          })
          .eq('id', alert.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      totalAlertsUpdated += enabledAlerts.length;
    }

    await recordAlertEvents([
      {
        userId: profile.user_id,
        eventType: 'scout_run',
        metadata: {
          matchesFound: alertMatches.length,
          grantsAdded: newGrants.length,
          notificationsQueued: notifiable.length,
          alertsUpdated: enabledAlerts.length,
        },
      },
    ]);
  }

  return {
    profilesScanned: profiles.length,
    grantsScored: grants?.length || 0,
    matchesFound: totalMatches,
    grantsAdded: totalAdded,
    notificationsQueued: totalQueued,
    alertsUpdated: totalAlertsUpdated,
  };
}

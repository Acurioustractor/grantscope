import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

type FoundationRow = {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  type: string | null;
  total_giving_annual: number | null;
  avg_grant_size: number | null;
  grant_range_min: number | null;
  grant_range_max: number | null;
  thematic_focus: string[] | null;
  geographic_focus: string[] | null;
  target_recipients: string[] | null;
  open_programs: Array<Record<string, unknown>> | null;
  profile_confidence: string | null;
  giving_philosophy: string | null;
  application_tips: string | null;
  notable_grants: string[] | null;
};

type PowerProfileRow = {
  foundation_id: string;
  capital_holder_class: string;
  capital_source_class: string;
  reportable_in_power_map: boolean;
  public_grant_surface: boolean;
  openness_score: number;
  approachability_score: number;
  gatekeeping_score: number;
  capital_power_score: number;
  classification_confidence: 'low' | 'medium' | 'high';
  reasons: string[] | null;
};

export interface PhilanthropyPowerMetrics {
  foundationCount: number;
  givingFoundationCount: number;
  excludedOperatorCount: number;
  excludedOperatorGiving: number;
  totalGiving: number;
  openCapitalShare: number;
  opaqueCapitalShare: number;
  relationshipReadyCount: number;
  relationshipReadyGiving: number;
  gatekeptGiving: number;
  withApplicationTips: number;
  withGivingPhilosophy: number;
  withOpenPrograms: number;
  withGeographicFocus: number;
}

export interface PhilanthropyFoundationProfile {
  name: string;
  totalGiving: number;
  opennessScore: number;
  capitalHolderClass: string;
  capitalSourceClass: string;
  opennessLabel: 'open' | 'mixed' | 'opaque';
  thematicFocus: string[];
  geographicFocus: string[];
  reasons: string[];
}

export interface PhilanthropyThemePower {
  theme: string;
  totalGiving: number;
  foundationCount: number;
  openCapitalShare: number;
  opaqueCapitalShare: number;
  avgOpenness: number;
  topFoundation: string;
}

export interface PhilanthropyGeographyPower {
  geography: string;
  totalGiving: number;
  foundationCount: number;
  openCapitalShare: number;
  topFoundation: string;
}

export interface PhilanthropyPowerReport {
  metrics: PhilanthropyPowerMetrics;
  gatekeepers: PhilanthropyFoundationProfile[];
  relationshipReady: PhilanthropyFoundationProfile[];
  themePower: PhilanthropyThemePower[];
  geographyPower: PhilanthropyGeographyPower[];
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function normalizeLabel(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchFoundationsWithGiving(supabase: SupabaseClient) {
  const rows: FoundationRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('foundations')
      .select(
        [
          'id',
          'name',
          'description',
          'website',
          'type',
          'total_giving_annual',
          'avg_grant_size',
          'grant_range_min',
          'grant_range_max',
          'thematic_focus',
          'geographic_focus',
          'target_recipients',
          'open_programs',
          'profile_confidence',
          'giving_philosophy',
          'application_tips',
          'notable_grants',
        ].join(', '),
      )
      .not('total_giving_annual', 'is', null)
      .gt('total_giving_annual', 0)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = ((data || []) as unknown) as FoundationRow[];
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += batch.length;
  }

  return rows;
}

async function fetchOpenClosedFoundationPrograms(supabase: SupabaseClient) {
  const rows: Array<{ foundation_id: string; status: string }> = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('foundation_programs')
      .select('foundation_id, status')
      .in('status', ['open', 'closed'])
      .order('foundation_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = ((data || []) as unknown) as Array<{ foundation_id: string; status: string }>;
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += batch.length;
  }

  return rows;
}

async function fetchPowerProfiles(supabase: SupabaseClient) {
  const rows: PowerProfileRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('foundation_power_profiles')
      .select([
        'foundation_id',
        'capital_holder_class',
        'capital_source_class',
        'reportable_in_power_map',
        'public_grant_surface',
        'openness_score',
        'approachability_score',
        'gatekeeping_score',
        'capital_power_score',
        'classification_confidence',
        'reasons',
      ].join(', '))
      .order('foundation_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = ((data || []) as unknown) as PowerProfileRow[];
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += batch.length;
  }

  return rows;
}

export async function buildPhilanthropyPowerReport(
  supabase: SupabaseClient,
): Promise<PhilanthropyPowerReport> {
  const rawFoundations = await fetchFoundationsWithGiving(supabase);
  const count = rawFoundations.length;

  const programRows = await fetchOpenClosedFoundationPrograms(supabase);

  const openProgramsByFoundation = new Map<string, number>();
  for (const row of programRows || []) {
    if (row.status !== 'open') continue;
    openProgramsByFoundation.set(
      row.foundation_id,
      (openProgramsByFoundation.get(row.foundation_id) || 0) + 1,
    );
  }

  const profileRows = await fetchPowerProfiles(supabase);

  const profilesByFoundation = new Map<string, PowerProfileRow>();
  for (const row of ((profileRows || []) as unknown) as PowerProfileRow[]) {
    profilesByFoundation.set(row.foundation_id, row);
  }

  const foundations = rawFoundations.filter((row) => profilesByFoundation.get(row.id)?.reportable_in_power_map);
  const excludedOperators = rawFoundations.filter((row) => {
    const profile = profilesByFoundation.get(row.id);
    return profile && !profile.reportable_in_power_map;
  });
  const totalGiving = foundations.reduce((sum, row) => sum + (Number(row.total_giving_annual) || 0), 0);
  const excludedOperatorGiving = excludedOperators.reduce((sum, row) => sum + (Number(row.total_giving_annual) || 0), 0);

  const scored = foundations.map((row) => {
    const total = Number(row.total_giving_annual) || 0;
    const openProgramCount = openProgramsByFoundation.get(row.id) || 0;
    const profile = profilesByFoundation.get(row.id);
    const opennessScore = Number(profile?.openness_score || 0);
    const opennessLabel: PhilanthropyFoundationProfile['opennessLabel'] =
      opennessScore >= 0.6 ? 'open' : opennessScore >= 0.35 ? 'mixed' : 'opaque';
    return {
      ...row,
      totalGiving: total,
      openProgramCount,
      opennessScore,
      opennessLabel,
      capitalHolderClass: profile?.capital_holder_class || 'unclear',
      capitalSourceClass: profile?.capital_source_class || 'unknown',
      reasons: profile?.reasons || [],
    };
  });

  const relationshipReady = scored.filter((row) => row.opennessScore >= 0.6);
  const gatekeepers = scored.filter((row) => row.opennessScore < 0.35);

  const relationshipReadyGiving = relationshipReady.reduce((sum, row) => sum + row.totalGiving, 0);
  const gatekeptGiving = gatekeepers.reduce((sum, row) => sum + row.totalGiving, 0);

  const metrics: PhilanthropyPowerMetrics = {
    foundationCount: count || 0,
    givingFoundationCount: foundations.length,
    excludedOperatorCount: excludedOperators.length,
    excludedOperatorGiving,
    totalGiving,
    openCapitalShare: totalGiving > 0 ? Number(((relationshipReadyGiving / totalGiving) * 100).toFixed(1)) : 0,
    opaqueCapitalShare: totalGiving > 0 ? Number(((gatekeptGiving / totalGiving) * 100).toFixed(1)) : 0,
    relationshipReadyCount: relationshipReady.length,
    relationshipReadyGiving,
    gatekeptGiving,
    withApplicationTips: scored.filter((row) => hasText(row.application_tips)).length,
    withGivingPhilosophy: scored.filter((row) => hasText(row.giving_philosophy)).length,
    withOpenPrograms: scored.filter((row) => row.openProgramCount > 0).length,
    withGeographicFocus: scored.filter((row) => (row.geographic_focus || []).length > 0).length,
  };

  const gatekeeperProfiles: PhilanthropyFoundationProfile[] = gatekeepers
    .sort((a, b) => b.totalGiving - a.totalGiving)
    .slice(0, 12)
    .map((row) => ({
      name: row.name,
      totalGiving: row.totalGiving,
      opennessScore: row.opennessScore,
      capitalHolderClass: row.capitalHolderClass,
      capitalSourceClass: row.capitalSourceClass,
      opennessLabel: row.opennessLabel,
      thematicFocus: row.thematic_focus || [],
      geographicFocus: row.geographic_focus || [],
      reasons: row.reasons,
    }));

  const relationshipProfiles: PhilanthropyFoundationProfile[] = relationshipReady
    .sort((a, b) => b.totalGiving * b.opennessScore - a.totalGiving * a.opennessScore)
    .slice(0, 12)
    .map((row) => ({
      name: row.name,
      totalGiving: row.totalGiving,
      opennessScore: row.opennessScore,
      capitalHolderClass: row.capitalHolderClass,
      capitalSourceClass: row.capitalSourceClass,
      opennessLabel: row.opennessLabel,
      thematicFocus: row.thematic_focus || [],
      geographicFocus: row.geographic_focus || [],
      reasons: row.reasons,
    }));

  const themeMap = new Map<
    string,
    {
      totalGiving: number;
      foundationCount: number;
      openGiving: number;
      opaqueGiving: number;
      opennessSum: number;
      topFoundation: string;
      topGiving: number;
    }
  >();

  for (const row of scored) {
    const themes = (row.thematic_focus && row.thematic_focus.length > 0 ? row.thematic_focus : ['unspecified']).map(normalizeLabel);
    for (const theme of themes) {
      const current = themeMap.get(theme) || {
        totalGiving: 0,
        foundationCount: 0,
        openGiving: 0,
        opaqueGiving: 0,
        opennessSum: 0,
        topFoundation: '',
        topGiving: 0,
      };
      current.totalGiving += row.totalGiving;
      current.foundationCount += 1;
      current.opennessSum += row.opennessScore;
      if (row.opennessScore >= 0.6) current.openGiving += row.totalGiving;
      if (row.opennessScore < 0.35) current.opaqueGiving += row.totalGiving;
      if (row.totalGiving > current.topGiving) {
        current.topGiving = row.totalGiving;
        current.topFoundation = row.name;
      }
      themeMap.set(theme, current);
    }
  }

  const themePower: PhilanthropyThemePower[] = Array.from(themeMap.entries())
    .map(([theme, value]) => ({
      theme,
      totalGiving: value.totalGiving,
      foundationCount: value.foundationCount,
      openCapitalShare:
        value.totalGiving > 0 ? Number(((value.openGiving / value.totalGiving) * 100).toFixed(1)) : 0,
      opaqueCapitalShare:
        value.totalGiving > 0 ? Number(((value.opaqueGiving / value.totalGiving) * 100).toFixed(1)) : 0,
      avgOpenness: Number((value.opennessSum / Math.max(value.foundationCount, 1)).toFixed(2)),
      topFoundation: value.topFoundation,
    }))
    .sort((a, b) => b.totalGiving - a.totalGiving)
    .slice(0, 12);

  const geographyMap = new Map<
    string,
    {
      totalGiving: number;
      foundationCount: number;
      openGiving: number;
      topFoundation: string;
      topGiving: number;
    }
  >();

  for (const row of scored) {
    const geographies = (row.geographic_focus && row.geographic_focus.length > 0 ? row.geographic_focus : ['National']).map(normalizeLabel);
    for (const geography of geographies) {
      const current = geographyMap.get(geography) || {
        totalGiving: 0,
        foundationCount: 0,
        openGiving: 0,
        topFoundation: '',
        topGiving: 0,
      };
      current.totalGiving += row.totalGiving;
      current.foundationCount += 1;
      if (row.opennessScore >= 0.6) current.openGiving += row.totalGiving;
      if (row.totalGiving > current.topGiving) {
        current.topGiving = row.totalGiving;
        current.topFoundation = row.name;
      }
      geographyMap.set(geography, current);
    }
  }

  const geographyPower: PhilanthropyGeographyPower[] = Array.from(geographyMap.entries())
    .map(([geography, value]) => ({
      geography,
      totalGiving: value.totalGiving,
      foundationCount: value.foundationCount,
      openCapitalShare:
        value.totalGiving > 0 ? Number(((value.openGiving / value.totalGiving) * 100).toFixed(1)) : 0,
      topFoundation: value.topFoundation,
    }))
    .sort((a, b) => b.totalGiving - a.totalGiving)
    .slice(0, 12);

  return {
    metrics,
    gatekeepers: gatekeeperProfiles,
    relationshipReady: relationshipProfiles,
    themePower,
    geographyPower,
  };
}

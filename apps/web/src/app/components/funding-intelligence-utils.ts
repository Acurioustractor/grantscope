const STATE_NAME_TO_CODE: Record<string, string> = {
  act: 'ACT',
  'australian capital territory': 'ACT',
  nsw: 'NSW',
  'new south wales': 'NSW',
  nt: 'NT',
  'northern territory': 'NT',
  qld: 'QLD',
  queensland: 'QLD',
  sa: 'SA',
  'south australia': 'SA',
  tas: 'TAS',
  tasmania: 'TAS',
  vic: 'VIC',
  victoria: 'VIC',
  wa: 'WA',
  'western australia': 'WA',
  australia: 'NATIONAL',
  national: 'NATIONAL',
  international: 'INTERNATIONAL',
};

export type FundingPowerTheme =
  | 'disability_ndis'
  | 'indigenous_community'
  | 'youth_justice'
  | 'housing_homelessness'
  | 'regional_regenerative';

const FUNDING_POWER_THEME_DEFINITIONS: Array<{
  key: FundingPowerTheme;
  label: string;
  description: string;
  matches: string[];
}> = [
  {
    key: 'disability_ndis',
    label: 'Disability / NDIS',
    description: 'Thin disability markets, NDIS concentration, and care alternatives.',
    matches: ['disab', 'ndis', 'autis', 'care', 'support'],
  },
  {
    key: 'indigenous_community',
    label: 'Indigenous / Community-Controlled',
    description: 'Community-controlled power, Indigenous business, and local alternatives.',
    matches: ['indigen', 'first nations', 'aboriginal', 'community control', 'community-controlled'],
  },
  {
    key: 'youth_justice',
    label: 'Youth Justice',
    description: 'Justice funding pressure, youth service delivery, and alternatives.',
    matches: ['youth justice', 'justice', 'youth', 'detention', 'bail', 'ex-offender'],
  },
  {
    key: 'housing_homelessness',
    label: 'Housing / Homelessness',
    description: 'Housing pressure, homelessness coverage, and grounded local providers.',
    matches: ['housing', 'homeless', 'homelessness', 'shelter'],
  },
  {
    key: 'regional_regenerative',
    label: 'Regional / Regenerative',
    description: 'Regional disadvantage, regenerative work, and place-based alternatives.',
    matches: ['regional', 'remote', 'regen', 'regenerative', 'climate', 'environment', 'nature'],
  },
];

export function normaliseTheme(raw: string | null | undefined) {
  if (!raw) return '';
  return raw.trim().toLowerCase();
}

export function detectFundingPowerTheme(raw: string | null | undefined): FundingPowerTheme | '' {
  const theme = normaliseTheme(raw);
  if (!theme) return '';
  const match = FUNDING_POWER_THEME_DEFINITIONS.find((definition) =>
    definition.matches.some((value) => theme.includes(value)),
  );
  return match?.key || '';
}

export function fundingPowerThemeLabel(theme: FundingPowerTheme) {
  return FUNDING_POWER_THEME_DEFINITIONS.find((definition) => definition.key === theme)?.label || theme;
}

export function fundingPowerThemeDescription(theme: FundingPowerTheme) {
  return (
    FUNDING_POWER_THEME_DEFINITIONS.find((definition) => definition.key === theme)?.description || ''
  );
}

export function mapThemeToFoundationFocus(raw: string | null | undefined) {
  const theme = normaliseTheme(raw);
  if (!theme) return '';
  if (theme.includes('indigen')) return 'indigenous';
  if (theme.includes('disab') || theme.includes('ndis') || theme.includes('autis') || theme.includes('care')) return 'disability';
  if (theme.includes('health') || theme.includes('medical') || theme.includes('wellbeing')) return 'health';
  if (theme.includes('educat') || theme.includes('school') || theme.includes('training')) return 'education';
  if (theme.includes('environment') || theme.includes('climate') || theme.includes('nature') || theme.includes('regen')) return 'environment';
  if (theme.includes('art') || theme.includes('culture')) return 'arts';
  if (theme.includes('communit') || theme.includes('social') || theme.includes('welfare') || theme.includes('housing') || theme.includes('justice')) return 'community';
  if (theme.includes('research')) return 'research';
  return '';
}

export function mapThemeToCharityPurpose(raw: string | null | undefined) {
  const theme = normaliseTheme(raw);
  if (!theme) return '';
  if (theme.includes('indigen')) return 'Reconciliation';
  if (theme.includes('disab') || theme.includes('ndis') || theme.includes('autis') || theme.includes('care')) return 'Health';
  if (theme.includes('health') || theme.includes('medical') || theme.includes('wellbeing')) return 'Health';
  if (theme.includes('educat') || theme.includes('school') || theme.includes('training')) return 'Education';
  if (theme.includes('environment') || theme.includes('climate') || theme.includes('nature') || theme.includes('regen')) return 'Environment';
  if (theme.includes('art') || theme.includes('culture')) return 'Culture';
  if (theme.includes('justice') || theme.includes('housing') || theme.includes('welfare') || theme.includes('community') || theme.includes('youth')) return 'Social Welfare';
  if (theme.includes('human rights')) return 'Human Rights';
  return '';
}

export function mapThemeToSocialEnterpriseSector(raw: string | null | undefined) {
  const theme = normaliseTheme(raw);
  if (!theme) return '';
  if (theme.includes('indigen')) return 'indigenous';
  if (theme.includes('disab') || theme.includes('ndis') || theme.includes('autis') || theme.includes('care')) return 'health';
  if (theme.includes('food')) return 'food';
  if (theme.includes('housing') || theme.includes('home')) return 'housing';
  if (theme.includes('environment') || theme.includes('climate') || theme.includes('regen')) return 'environment';
  if (theme.includes('art') || theme.includes('culture')) return 'arts';
  if (theme.includes('health') || theme.includes('wellbeing')) return 'health';
  if (theme.includes('educat') || theme.includes('training')) return 'education';
  if (theme.includes('tech') || theme.includes('digital')) return 'technology';
  if (theme.includes('employ') || theme.includes('job')) return 'employment';
  if (theme.includes('communit')) return 'community';
  return '';
}

export function toStateCode(raw: string | null | undefined) {
  if (!raw) return '';
  return raw.replace(/^AU-/, '').trim();
}

export function coerceStateSignal(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('AU-')) {
    return toStateCode(trimmed).toUpperCase();
  }
  const mapped = STATE_NAME_TO_CODE[trimmed.toLowerCase()];
  return mapped || trimmed.toUpperCase();
}

export function compactUnique(values: Array<string | null | undefined>, limit = 6) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

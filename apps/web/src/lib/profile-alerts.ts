export const DEFAULT_PROFILE_ALERT_NAME = 'Profile Grant Alert';

const SUPPORTED_STATE_CODES = new Set(['nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt']);

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeAlertStates(geographicFocus: string[] = []): string[] {
  return unique(
    geographicFocus.flatMap((value) => {
      const normalized = value.toLowerCase().trim();
      if (!normalized) return [];
      if (normalized === 'national') return ['National'];
      if (SUPPORTED_STATE_CODES.has(normalized)) return [normalized.toUpperCase()];
      return [];
    })
  );
}

export function buildProfileAlertPreference({
  domains = [],
  geographicFocus = [],
  notifyEmail = true,
}: {
  domains?: string[];
  geographicFocus?: string[];
  notifyEmail?: boolean;
}) {
  const normalizedDomains = unique(domains);
  const normalizedStates = normalizeAlertStates(geographicFocus);
  const hasSignal = normalizedDomains.length > 0 || normalizedStates.length > 0;

  return {
    hasSignal,
    values: {
      name: DEFAULT_PROFILE_ALERT_NAME,
      enabled: notifyEmail && hasSignal,
      frequency: 'weekly' as const,
      categories: normalizedDomains,
      focus_areas: normalizedDomains,
      states: normalizedStates,
      min_amount: null as number | null,
      max_amount: null as number | null,
      keywords: [] as string[],
      entity_types: [] as string[],
    },
  };
}

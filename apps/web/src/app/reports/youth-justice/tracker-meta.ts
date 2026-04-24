export const TRACKER_STATE_META: Record<string, { name: string; abbr: string }> = {
  qld: { name: 'Queensland', abbr: 'QLD' },
  nsw: { name: 'New South Wales', abbr: 'NSW' },
  vic: { name: 'Victoria', abbr: 'VIC' },
  wa: { name: 'Western Australia', abbr: 'WA' },
  sa: { name: 'South Australia', abbr: 'SA' },
  nt: { name: 'Northern Territory', abbr: 'NT' },
  tas: { name: 'Tasmania', abbr: 'TAS' },
  act: { name: 'Australian Capital Territory', abbr: 'ACT' },
};

export function titleFromTrackerKey(key: string) {
  return key.replaceAll('-', ' ');
}

export function sentenceCaseTracker(value: string) {
  const text = titleFromTrackerKey(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function slugifySegment(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return `${Math.round(value)}%`;
}

export function districtLabel(name: string): string {
  return name.replace(/~[A-Z]+$/, '');
}

export function validNdisDistrict(name: string | null | undefined): name is string {
  if (!name) return false;
  const normalized = districtLabel(name).trim();
  return normalized.length > 0 &&
    normalized !== 'ALL' &&
    normalized !== 'Other' &&
    normalized !== 'Other Territories' &&
    !normalized.toLowerCase().includes('missing') &&
    !normalized.startsWith('OT_');
}

export function hasDisabilitySignal(values: Array<string | null | undefined> | null | undefined): boolean {
  if (!values || values.length === 0) return false;
  return values.some((value) => {
    const normalized = String(value || '').toLowerCase();
    return normalized.includes('disab') || normalized.includes('ndis') || normalized.includes('mental illness');
  });
}

export function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    charity: 'Charity',
    foundation: 'Foundation',
    company: 'Company',
    government_body: 'Government Body',
    indigenous_corp: 'Indigenous Corporation',
    political_party: 'Political Party',
    social_enterprise: 'Social Enterprise',
    trust: 'Trust',
    person: 'Person',
    unknown: 'Unknown',
  };
  return labels[type] || type;
}

export function entityTypeBadge(type: string): string {
  const styles: Record<string, string> = {
    charity: 'border-money bg-money-light text-money',
    foundation: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
    company: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-black',
    government_body: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
    indigenous_corp: 'border-bauhaus-red bg-error-light text-bauhaus-red',
    political_party: 'border-bauhaus-red bg-error-light text-bauhaus-red',
    social_enterprise: 'border-money bg-money-light text-money',
  };
  return styles[type] || 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
}

export function confidenceBadge(c: string): { cls: string; label: string } {
  if (c === 'registry') return { cls: 'border-money bg-money-light text-money', label: 'Registry' };
  if (c === 'verified') return { cls: 'border-bauhaus-blue bg-link-light text-bauhaus-blue', label: 'Verified' };
  if (c === 'reported') return { cls: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black', label: 'Reported' };
  return { cls: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted', label: c };
}

export function relTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    donation: 'Political Donation',
    contract: 'Government Contract',
    grant: 'Grant',
    subsidiary_of: 'Subsidiary Of',
    charity_link: 'Charity Link',
    registered_as: 'Registered As',
    lobbies_for: 'Lobbies For',
    member_of: 'Member Of',
    ownership: 'Ownership',
    directorship: 'Directorship',
    program_funding: 'Program Funding',
    tax_record: 'Tax Record',
    listed_as: 'Listed As',
  };
  return labels[type] || type.replace(/_/g, ' ');
}

export function datasetLabel(ds: string): string {
  const labels: Record<string, string> = {
    acnc: 'ACNC',
    foundations: 'Foundations',
    oric: 'ORIC',
    austender: 'AusTender',
    aec_donations: 'AEC Donations',
    ato_tax: 'ATO Tax',
    asx: 'ASX',
    social_enterprises: 'Social Enterprises',
    modern_slavery: 'Modern Slavery Register',
    lobbying_register: 'Lobbying Register',
  };
  return labels[ds] || ds;
}

export function getShortlistIdFromPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/')) return null;
  try {
    return new URL(path, 'https://grantscope.local').searchParams.get('shortlistId');
  } catch {
    return null;
  }
}

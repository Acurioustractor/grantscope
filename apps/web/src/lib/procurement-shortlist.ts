export const SHORTLIST_DECISIONS = [
  { value: '', label: 'Untriaged' },
  { value: 'priority', label: 'Priority' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'engage', label: 'Engage' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'not_now', label: 'Not now' },
] as const;

export function decisionTagLabel(value: string | null | undefined) {
  return SHORTLIST_DECISIONS.find((option) => option.value === (value || ''))?.label || 'Untriaged';
}

export function decisionTagBadgeClass(value: string | null | undefined) {
  switch (value) {
    case 'priority':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    case 'reviewing':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'engage':
      return 'border-money bg-money-light text-money';
    case 'monitor':
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    case 'not_now':
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
}

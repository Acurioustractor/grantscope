import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatPercent,
  entityTypeLabel,
  entityTypeBadge,
  confidenceBadge,
  relTypeLabel,
  datasetLabel,
  hasDisabilitySignal,
  validNdisDistrict,
  getShortlistIdFromPath,
} from '@/app/entities/[gsId]/_lib/formatters';

describe('formatMoney', () => {
  it('formats billions', () => {
    expect(formatMoney(385_406_967_173)).toBe('$385.4B');
  });

  it('formats millions', () => {
    expect(formatMoney(42_500_000)).toBe('$42.5M');
  });

  it('formats thousands', () => {
    expect(formatMoney(150_000)).toBe('$150K');
  });

  it('formats small amounts', () => {
    expect(formatMoney(500)).toBe('$500');
  });

  it('handles null', () => {
    expect(formatMoney(null)).toBe('\u2014');
  });

  it('handles zero', () => {
    expect(formatMoney(0)).toBe('\u2014');
  });
});

describe('formatPercent', () => {
  it('formats percentage', () => {
    expect(formatPercent(42.7)).toBe('43%');
  });

  it('handles null', () => {
    expect(formatPercent(null)).toBe('\u2014');
  });

  it('handles undefined', () => {
    expect(formatPercent(undefined)).toBe('\u2014');
  });
});

describe('entityTypeLabel', () => {
  it('returns label for known types', () => {
    expect(entityTypeLabel('charity')).toBe('Charity');
    expect(entityTypeLabel('government_body')).toBe('Government Body');
    expect(entityTypeLabel('indigenous_corp')).toBe('Indigenous Corporation');
  });

  it('returns raw type for unknown types', () => {
    expect(entityTypeLabel('mysterious')).toBe('mysterious');
  });
});

describe('entityTypeBadge', () => {
  it('returns styling for known types', () => {
    expect(entityTypeBadge('charity')).toContain('border-money');
    expect(entityTypeBadge('government_body')).toContain('border-bauhaus-yellow');
  });

  it('returns default styling for unknown types', () => {
    expect(entityTypeBadge('mysterious')).toContain('border-bauhaus-black/20');
  });
});

describe('confidenceBadge', () => {
  it('returns registry badge', () => {
    const b = confidenceBadge('registry');
    expect(b.label).toBe('Registry');
    expect(b.cls).toContain('border-money');
  });

  it('returns fallback for unknown confidence', () => {
    const b = confidenceBadge('unknown');
    expect(b.label).toBe('unknown');
  });
});

describe('relTypeLabel', () => {
  it('returns label for known types', () => {
    expect(relTypeLabel('donation')).toBe('Political Donation');
    expect(relTypeLabel('contract')).toBe('Government Contract');
  });

  it('humanizes unknown types', () => {
    expect(relTypeLabel('some_type')).toBe('some type');
  });
});

describe('datasetLabel', () => {
  it('returns label for known datasets', () => {
    expect(datasetLabel('austender')).toBe('AusTender');
    expect(datasetLabel('acnc')).toBe('ACNC');
  });

  it('returns raw name for unknown datasets', () => {
    expect(datasetLabel('custom')).toBe('custom');
  });
});

describe('hasDisabilitySignal', () => {
  it('detects disability keyword', () => {
    expect(hasDisabilitySignal(['People with disabilities'])).toBe(true);
  });

  it('detects NDIS keyword', () => {
    expect(hasDisabilitySignal(['NDIS provider'])).toBe(true);
  });

  it('returns false for unrelated values', () => {
    expect(hasDisabilitySignal(['Education', 'Health'])).toBe(false);
  });

  it('handles null/empty', () => {
    expect(hasDisabilitySignal(null)).toBe(false);
    expect(hasDisabilitySignal([])).toBe(false);
  });
});

describe('validNdisDistrict', () => {
  it('accepts valid district names', () => {
    expect(validNdisDistrict('Sydney South West')).toBe(true);
  });

  it('rejects ALL', () => {
    expect(validNdisDistrict('ALL')).toBe(false);
  });

  it('rejects Other', () => {
    expect(validNdisDistrict('Other')).toBe(false);
  });

  it('rejects Missing', () => {
    expect(validNdisDistrict('Missing Data')).toBe(false);
  });

  it('rejects null', () => {
    expect(validNdisDistrict(null)).toBe(false);
  });
});

describe('getShortlistIdFromPath', () => {
  it('extracts shortlistId from path', () => {
    expect(getShortlistIdFromPath('/tender-intelligence?shortlistId=abc123')).toBe('abc123');
  });

  it('returns null for paths without shortlistId', () => {
    expect(getShortlistIdFromPath('/entities')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getShortlistIdFromPath(null)).toBeNull();
  });

  it('returns null for non-path strings', () => {
    expect(getShortlistIdFromPath('not-a-path')).toBeNull();
  });
});

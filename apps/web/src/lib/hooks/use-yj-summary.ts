'use client';

import { useEffect, useState } from 'react';

export type Lane = 'reactive' | 'prevention' | 'community-led' | 'unclassified';

export interface YJRecipient {
  name: string;
  gs_id: string | null;
  entity_id: string | null;
  lane: Lane;
  total: number;
  grant_count: number;
  state: string | null;
  first_year: number | null;
  last_year: number | null;
}

export interface YJYearLane {
  year: number;
  lane: Lane;
  total: number;
  grant_count: number;
}

export interface YJStateLane {
  state: string;
  lane: Lane;
  total: number;
  recipient_count: number;
}

export interface YJTotals {
  reactive: number;
  prevention: number;
  'community-led': number;
  unclassified: number;
  all: number;
}

export interface YJSummary {
  top_recipients: YJRecipient[];
  by_year_lane: YJYearLane[];
  by_state_lane: YJStateLane[];
  totals: YJTotals;
  meta: {
    recipient_count: number;
    year_range: { min: number; max: number };
    filters: { state: string | null; minAmount: number; topN: number };
  };
}

export const LANE_COLOR: Record<Lane, string> = {
  reactive: '#D02020',
  prevention: '#1040C0',
  'community-led': '#F0C020',
  unclassified: '#6B7280',
};

export const LANE_LABEL: Record<Lane, string> = {
  reactive: 'Reactive',
  prevention: 'Prevention',
  'community-led': 'Community-led',
  unclassified: 'Unclassified',
};

export function fmtMoney(v: number): string {
  if (!v || v === 0) return '$0';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function useYJSummary(opts?: { state?: string; minAmount?: number; topN?: number }) {
  const [data, setData] = useState<YJSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const state = opts?.state || '';
  const minAmount = opts?.minAmount ?? 50000;
  const topN = opts?.topN ?? 400;

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    params.set('min_amount', String(minAmount));
    params.set('top_n', String(topN));

    fetch(`/api/data/youth-justice-summary?${params.toString()}`)
      .then(r => r.json())
      .then((d: YJSummary | { error: string }) => {
        if ('error' in d) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Failed to load');
        setLoading(false);
      });
  }, [state, minAmount, topN]);

  return { data, loading, error };
}

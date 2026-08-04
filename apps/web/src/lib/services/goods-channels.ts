import { getServiceSupabase } from '@/lib/supabase';

export type ChannelArchetype =
  | 'health_service'
  | 'housing_logistics'
  | 'womens_council'
  | 'community_store'
  | 'land_council'
  | 'other';

export interface ChannelRow {
  entity_id: string;
  canonical_name: string;
  abn: string | null;
  lga_name: string | null;
  oric_size: string | null;
  oric_employee_band: string | null;
  total_traceable_value: number | null;
  channel_archetype: ChannelArchetype;
  goods_relationship_id: string | null;
  relationship_type: string | null;
  stage: string | null;
  warmth_display: number | null;
  next_action: string | null;
}

export interface ChannelsSummary {
  total: number;
  in_pipeline: number;
  by_archetype: Record<string, { total: number; in_pipeline: number }>;
  by_lga: Record<string, number>;
}

export const ARCHETYPE_LABELS: Record<ChannelArchetype, string> = {
  health_service: 'Health service',
  housing_logistics: 'Housing & logistics',
  womens_council: "Women's council",
  community_store: 'Community store',
  land_council: 'Land council',
  other: 'Other',
};

export async function getGoodsChannels(opts: {
  archetype?: string;
  lga?: string;
  scope?: 'pipeline' | 'all';
  search?: string;
}): Promise<{ channels: ChannelRow[]; summary: ChannelsSummary }> {
  const db = getServiceSupabase();

  // Full set for summary counts; the view is small (~460 rows).
  const { data, error } = await db
    .from('v_goods_central_channels')
    .select('*')
    .order('total_traceable_value', { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(`v_goods_central_channels: ${error.message}`);
  const all = (data || []) as ChannelRow[];

  const summary: ChannelsSummary = { total: all.length, in_pipeline: 0, by_archetype: {}, by_lga: {} };
  for (const row of all) {
    const a = (summary.by_archetype[row.channel_archetype] ||= { total: 0, in_pipeline: 0 });
    a.total += 1;
    if (row.goods_relationship_id) {
      a.in_pipeline += 1;
      summary.in_pipeline += 1;
    }
    if (row.lga_name) summary.by_lga[row.lga_name] = (summary.by_lga[row.lga_name] || 0) + 1;
  }

  let channels = all;
  if (opts.archetype) channels = channels.filter((c) => c.channel_archetype === opts.archetype);
  if (opts.lga) channels = channels.filter((c) => c.lga_name === opts.lga);
  if (opts.scope === 'pipeline') channels = channels.filter((c) => c.goods_relationship_id);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    channels = channels.filter((c) => c.canonical_name.toLowerCase().includes(q));
  }

  return { channels, summary };
}

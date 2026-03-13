import { getServiceSupabase } from '@/lib/supabase';

export interface GrantScopePlaceBundleContribution {
  subjectType: 'place';
  subjectId: string;
  placeKey: string;
  capitalContext: {
    fundingByPostcode: Record<string, unknown> | null;
    fundingSummaries: Record<string, unknown>[];
    entitySamples: Record<string, unknown>[];
  };
  confidence: {
    capital: number;
  };
}

export async function buildGrantScopePlaceBundleContribution(
  placeKey: string
): Promise<GrantScopePlaceBundleContribution> {
  const supabase = getServiceSupabase() as any;

  const [{ data: fundingSummaries, error: fundingError }, { data: entitySamples, error: entitiesError }] =
    await Promise.all([
      supabase
        .from('mv_funding_by_postcode')
        .select('*')
        .eq('postcode', placeKey)
        .order('total_funding', { ascending: false })
        .limit(25),
      supabase
        .from('gs_entities')
        .select('id, canonical_name, entity_type, abn, postcode, lga_name, remoteness, seifa_irsd_decile, is_community_controlled')
        .eq('postcode', placeKey)
        .limit(25),
    ]);

  if (fundingError) throw fundingError;
  if (entitiesError) throw entitiesError;

  return {
    subjectType: 'place',
    subjectId: placeKey,
    placeKey,
    capitalContext: {
      fundingByPostcode: fundingSummaries?.[0] ?? null,
      fundingSummaries: fundingSummaries ?? [],
      entitySamples: entitySamples ?? [],
    },
    confidence: {
      capital: fundingSummaries && fundingSummaries.length > 0 ? 0.9 : 0.6,
    },
  };
}

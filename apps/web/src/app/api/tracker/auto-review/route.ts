import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

type Lens = 'ACT' | 'Goods' | 'JusticeHub' | 'Empathy Ledger';

type SavedGrantForReview = {
  id: string;
  grant_id: string;
  stage: string;
  stars: number | null;
  grant: {
    id: string;
    name: string | null;
    provider: string | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[] | null;
    url: string | null;
    updated_at: string | null;
    description: string | null;
    focus_areas: string[] | null;
    source: string | null;
    fit_score: number | null;
    relevance_score: number | null;
  } | null;
};

const REVIEW_GATE_THRESHOLD = 65;
const OBVIOUS_NO_GO_THRESHOLD = 35;
const STALE_DAYS = 30;

const TRIAGE_KEYWORDS: Record<Lens, string[]> = {
  ACT: [
    'aboriginal',
    'advocacy',
    'arts',
    'civic',
    'community',
    'culture',
    'data',
    'digital',
    'equity',
    'evidence',
    'first nations',
    'health equity',
    'indigenous',
    'infrastructure',
    'justice',
    'lived experience',
    'procurement',
    'regional',
    'remote',
    'rural',
    'social enterprise',
    'social impact',
    'story',
    'systems',
    'youth',
  ],
  Goods: [
    'bed',
    'circular',
    'equipment',
    'first nations',
    'goods',
    'health',
    'housing',
    'indigenous',
    'infrastructure',
    'laundry',
    'manufacturing',
    'mattress',
    'medical equipment',
    'procurement',
    'regional',
    'remote',
    'repair',
    'supplies',
    'washing',
  ],
  JusticeHub: [
    'aboriginal',
    'children',
    'community safety',
    'court',
    'crime',
    'diversion',
    'family',
    'first nations',
    'indigenous',
    'justice',
    'legal',
    'police',
    'prevention',
    'reintegration',
    'social justice',
    'youth',
  ],
  'Empathy Ledger': [
    'advocacy',
    'arts',
    'consent',
    'creative',
    'culture',
    'data',
    'digital',
    'human rights',
    'lived experience',
    'media',
    'narrative',
    'privacy',
    'story',
    'storytelling',
    'voice',
  ],
};

function normalise(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function textFor(row: SavedGrantForReview) {
  const grant = row.grant;
  return [
    grant?.name,
    grant?.provider,
    grant?.description,
    grant?.source,
    ...(grant?.categories || []),
    ...(grant?.focus_areas || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function keywordHits(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(keyword));
}

function addCount(map: Map<string, number>, value: string | null | undefined) {
  const key = normalise(value);
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function buildLearning(rows: SavedGrantForReview[]) {
  const rejectedProviders = new Map<string, number>();
  const rejectedCategories = new Map<string, number>();
  const rejectedFocusAreas = new Map<string, number>();

  for (const row of rows) {
    if (row.stage !== 'lost' || !row.grant) continue;
    addCount(rejectedProviders, row.grant.provider);
    for (const category of row.grant.categories || []) addCount(rejectedCategories, category);
    for (const focus of row.grant.focus_areas || []) addCount(rejectedFocusAreas, focus);
  }

  return { rejectedProviders, rejectedCategories, rejectedFocusAreas };
}

function similarityPenalty(values: string[] | null | undefined, rejectedMap: Map<string, number>, maxPenalty: number) {
  let penalty = 0;
  for (const value of values || []) {
    const count = rejectedMap.get(normalise(value)) || 0;
    if (count >= 8) penalty += 10;
    else if (count >= 4) penalty += 6;
    else if (count >= 2) penalty += 3;
  }
  return Math.min(penalty, maxPenalty);
}

function isExpired(row: SavedGrantForReview) {
  if (!row.grant?.closes_at) return false;
  return new Date(row.grant.closes_at).getTime() < Date.now();
}

function isStale(row: SavedGrantForReview) {
  if (!row.grant?.updated_at) return false;
  return new Date(row.grant.updated_at).getTime() < Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
}

function needsSourceCleanup(row: SavedGrantForReview) {
  if (!row.grant) return true;
  if (!row.grant.url) return true;
  if (!row.grant.closes_at) return true;
  if (isStale(row)) return true;
  return false;
}

function assess(row: SavedGrantForReview, lens: Lens, learning: ReturnType<typeof buildLearning>) {
  const grant = row.grant;
  if (!grant) return { score: 0, reviewable: false, reasons: ['Missing grant record'] };

  const text = textFor(row);
  const actHits = keywordHits(text, TRIAGE_KEYWORDS.ACT);
  const lensHits = lens === 'ACT' ? actHits : keywordHits(text, TRIAGE_KEYWORDS[lens]);
  const dbScore = Math.max(grant.fit_score || 0, grant.relevance_score || 0);
  const starScore = (row.stars || 0) * 18;
  const strongExplicitSignal = dbScore >= 75 || starScore >= 36;
  let score = Math.max(dbScore, starScore);
  const reasons: string[] = [];

  if (actHits.length > 0) {
    score += Math.min(actHits.length * 5, 35);
    reasons.push(`ACT language: ${actHits.slice(0, 3).join(', ')}`);
  }

  if (lens !== 'ACT') {
    if (lensHits.length > 0) {
      score += Math.min(lensHits.length * 8, 35);
      reasons.push(`${lens} language: ${lensHits.slice(0, 3).join(', ')}`);
    } else {
      score -= 25;
      reasons.push(`No ${lens} signal`);
    }
  }

  const providerRejects = learning.rejectedProviders.get(normalise(grant.provider)) || 0;
  if (providerRejects >= 4) {
    score -= 35;
    reasons.push(`Provider rejected ${providerRejects}x`);
  } else if (providerRejects >= 2) {
    score -= 22;
    reasons.push(`Provider rejected ${providerRejects}x`);
  } else if (providerRejects === 1) {
    score -= 8;
  }

  const categoryPenalty = similarityPenalty(grant.categories, learning.rejectedCategories, 22);
  if (categoryPenalty > 0) {
    score -= categoryPenalty;
    reasons.push('Similar rejected category');
  }

  const focusPenalty = similarityPenalty(grant.focus_areas, learning.rejectedFocusAreas, 18);
  if (focusPenalty > 0) {
    score -= focusPenalty;
    reasons.push('Similar rejected focus');
  }

  if (!grant.description || grant.description.length < 80) {
    score -= 6;
    reasons.push('Thin source record');
  }

  if (!actHits.length && dbScore < 55) {
    score -= 30;
    reasons.push('Weak ACT fit');
  }

  if (grant.amount_max && grant.amount_max >= 50_000) {
    score += 5;
    reasons.push('Useful grant size');
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const hasLensSignal = lens === 'ACT'
    ? actHits.length > 0 || strongExplicitSignal
    : lensHits.length > 0;

  return {
    score: finalScore,
    reviewable: finalScore >= REVIEW_GATE_THRESHOLD && hasLensSignal,
    reasons,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('tracker');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json().catch(() => ({})) as { lens?: Lens };
  const lens: Lens = body.lens && body.lens in TRIAGE_KEYWORDS ? body.lens : 'ACT';
  const db = getServiceSupabase();

  const { data: rows, error } = await db
    .from('saved_grants')
    .select('id, grant_id, stage, stars, grant:grant_opportunities(id, name, provider, amount_max, closes_at, categories, url, updated_at, description, focus_areas, source, fit_score, relevance_score)')
    .eq('user_id', user.id)
    .in('stage', ['discovered', 'lost']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reviewRows = (rows || []) as unknown as SavedGrantForReview[];
  const learning = buildLearning(reviewRows);
  const discovered = reviewRows.filter((row) => row.stage === 'discovered');
  const now = new Date().toISOString();
  const expiredIds: string[] = [];
  const sourceCleanupIds: string[] = [];
  const lostIds: string[] = [];
  const keptIds: string[] = [];

  for (const row of discovered) {
    if (isExpired(row)) {
      expiredIds.push(row.id);
      continue;
    }

    const assessment = assess(row, lens, learning);

    if (needsSourceCleanup(row)) {
      sourceCleanupIds.push(row.id);
      continue;
    }

    if (!assessment.reviewable && assessment.score < OBVIOUS_NO_GO_THRESHOLD) {
      lostIds.push(row.id);
      continue;
    }

    keptIds.push(row.id);
  }

  const updateStage = async (ids: string[], stage: string) => {
    if (ids.length === 0) return 0;
    const { data, error: updateError } = await db
      .from('saved_grants')
      .update({ stage, updated_at: now })
      .eq('user_id', user.id)
      .in('id', ids)
      .select('id');
    if (updateError) throw updateError;
    return data?.length || 0;
  };

  try {
    const sourceCleanup = sourceCleanupIds.length;
    const [expired, movedOut] = await Promise.all([
      updateStage(expiredIds, 'expired'),
      updateStage([...sourceCleanupIds, ...lostIds], 'lost'),
    ]);
    const lost = Math.max(0, movedOut - sourceCleanup);

    return NextResponse.json({
      ok: true,
      lens,
      reviewed: discovered.length,
      applied: {
        expired,
        sourceCleanup,
        lost,
        keptReviewable: keptIds.length,
      },
      message: `Machine reviewed ${discovered.length} discovered grants: ${keptIds.length} kept for ranking, ${lost} obvious no-go, ${sourceCleanup} weak-source/no-deadline, ${expired} expired.`,
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : 'Machine review update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlaceTranscript {
  id: string;
  title: string;
  storyteller_name: string;
  word_count: number;
  has_video: boolean;
  themes: string[] | null;
  excerpt: string;
}

export interface AlmaIntervention {
  name: string;
  type: string;
  evidence_level: string;
  linked: boolean;
}

export interface AlignmentScore {
  score: number; // 0-100
  label: string;
  evidenceCount: number;
  fundedEvidenceCount: number;
  unfundedInterventions: string[];
  transcriptCount: number;
  detail: string;
}

export interface PlaceBriefData {
  transcripts: PlaceTranscript[];
  interventions: AlmaIntervention[];
  alignment: AlignmentScore;
}

function locationPatterns(postcode: string, locality: string | null, state: string | null): string[] {
  const patterns: string[] = [];
  if (locality) {
    patterns.push(`%${locality}%`);
    // Handle multi-word localities like "Alice Springs"
    const words = locality.split(/\s+/);
    if (words.length > 1) {
      patterns.push(`%${words[0]}%${words[words.length - 1]}%`);
    }
  }
  return patterns;
}

export async function getPlaceBrief(
  db: SupabaseClient,
  postcode: string,
  locality: string | null,
  state: string | null,
): Promise<PlaceBriefData> {
  // Fetch transcripts + ALMA interventions in parallel
  const patterns = locationPatterns(postcode, locality, state);

  // Build transcript query — match by location ILIKE patterns
  let transcripts: PlaceTranscript[] = [];
  if (patterns.length > 0) {
    // Try each pattern until we get results
    for (const pattern of patterns) {
      const { data } = await db
        .from('el_transcripts')
        .select('id, title, content, storyteller_name, word_count, has_video, themes')
        .ilike('location', pattern)
        .eq('status', 'published')
        .order('word_count', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        transcripts = data.map((t) => ({
          id: t.id,
          title: t.title || 'Untitled',
          storyteller_name: t.storyteller_name || 'Anonymous',
          word_count: t.word_count || 0,
          has_video: t.has_video || false,
          themes: t.themes,
          excerpt: extractExcerpt(t.content, 200),
        }));
        break;
      }
    }

    // If no published transcripts found, try without status filter
    if (transcripts.length === 0) {
      for (const pattern of patterns) {
        const { data } = await db
          .from('el_transcripts')
          .select('id, title, content, storyteller_name, word_count, has_video, themes')
          .ilike('location', pattern)
          .order('word_count', { ascending: false })
          .limit(20);

        if (data && data.length > 0) {
          transcripts = data.map((t) => ({
            id: t.id,
            title: t.title || 'Untitled',
            storyteller_name: t.storyteller_name || 'Anonymous',
            word_count: t.word_count || 0,
            has_video: t.has_video || false,
            themes: t.themes,
            excerpt: extractExcerpt(t.content, 200),
          }));
          break;
        }
      }
    }
  }

  // Fetch ALMA interventions for this area
  // geography is text[] — cast to text for ILIKE
  let interventions: AlmaIntervention[] = [];
  if (locality) {
    const { data } = await db.rpc('exec_sql', {
      query: `SELECT name, type, evidence_level, gs_entity_id IS NOT NULL as linked
        FROM alma_interventions
        WHERE geography::text ILIKE '%${locality.replace(/'/g, "''")}%'
        ORDER BY CASE WHEN gs_entity_id IS NOT NULL THEN 0 ELSE 1 END, name
        LIMIT 30`,
    });
    if (data && Array.isArray(data)) {
      interventions = data.map((row: Record<string, unknown>) => ({
        name: String(row.name || ''),
        type: String(row.type || ''),
        evidence_level: String(row.evidence_level || ''),
        linked: row.linked === true || row.linked === 't',
      }));
    }
  }

  // Compute alignment score
  const alignment = computeAlignmentScore(interventions, transcripts);

  return { transcripts, interventions, alignment };
}

function computeAlignmentScore(
  interventions: AlmaIntervention[],
  transcripts: PlaceTranscript[],
): AlignmentScore {
  if (interventions.length === 0 && transcripts.length === 0) {
    return {
      score: 0,
      label: 'No Data',
      evidenceCount: 0,
      fundedEvidenceCount: 0,
      unfundedInterventions: [],
      transcriptCount: 0,
      detail: 'No ALMA interventions or community voice data found for this area.',
    };
  }

  const evidenceCount = interventions.length;
  const fundedEvidenceCount = interventions.filter((i) => i.linked).length;
  const unfundedInterventions = interventions
    .filter((i) => !i.linked)
    .map((i) => i.name);
  const transcriptCount = transcripts.length;

  // Score components (out of 100):
  // - Evidence coverage: 40pts (has interventions with evidence)
  // - Funding alignment: 40pts (funded interventions / total)
  // - Community voice: 20pts (has transcripts)

  let evidenceScore = 0;
  if (evidenceCount > 0) {
    const strongEvidence = interventions.filter(
      (i) => i.evidence_level.includes('Effective') || i.evidence_level.includes('Strong'),
    ).length;
    const promisingEvidence = interventions.filter(
      (i) => i.evidence_level.includes('Promising') || i.evidence_level.includes('Indigenous'),
    ).length;
    // Up to 40 points: weighted by evidence strength
    evidenceScore = Math.min(40, (strongEvidence * 10 + promisingEvidence * 5 + evidenceCount * 2));
  }

  let fundingScore = 0;
  if (evidenceCount > 0) {
    const ratio = fundedEvidenceCount / evidenceCount;
    fundingScore = Math.round(ratio * 40);
  }

  let voiceScore = 0;
  if (transcriptCount > 0) {
    voiceScore = Math.min(20, transcriptCount * 4);
  }

  const score = evidenceScore + fundingScore + voiceScore;

  let label: string;
  if (score >= 75) label = 'Strong';
  else if (score >= 50) label = 'Moderate';
  else if (score >= 25) label = 'Weak';
  else label = 'Critical Gap';

  const parts: string[] = [];
  if (evidenceCount > 0) {
    parts.push(`${evidenceCount} evidence-based interventions (${fundedEvidenceCount} funded)`);
  }
  if (unfundedInterventions.length > 0) {
    parts.push(`${unfundedInterventions.length} unfunded despite evidence`);
  }
  if (transcriptCount > 0) {
    parts.push(`${transcriptCount} community voice records`);
  }

  return {
    score,
    label,
    evidenceCount,
    fundedEvidenceCount,
    unfundedInterventions,
    transcriptCount,
    detail: parts.join('. ') + '.',
  };
}

function extractExcerpt(content: string | null, maxLength: number): string {
  if (!content) return '';
  // Skip common transcript headers/metadata
  const cleaned = content
    .replace(/^#{1,3}\s.*$/gm, '') // remove markdown headings
    .replace(/^\s*[-*]\s*(Speaker|Date|Location|Duration):.*$/gim, '') // metadata lines
    .trim();

  // Find first substantial paragraph (>40 chars)
  const paragraphs = cleaned.split(/\n\n+/);
  const substantive = paragraphs.find((p) => p.trim().length > 40);
  const text = (substantive || paragraphs[0] || '').trim();

  if (text.length <= maxLength) return text;
  // Cut at last word boundary before maxLength
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

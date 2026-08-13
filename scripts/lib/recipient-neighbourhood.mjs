const BLOCKS = [
  {
    id: 'measured_run',
    label: 'Measured production run',
    weight: 5,
    terms: ['essential goods', 'household goods', 'beds', 'bedding', 'mattress', 'healthy homes', 'housing hardware', 'material aid', 'practical support'],
  },
  {
    id: 'running_cover',
    label: 'Operating and organisational capacity',
    weight: 4,
    terms: ['core funding', 'operating costs', 'operational costs', 'capacity building', 'organisational capacity', 'wages', 'salaries', 'overheads'],
  },
  {
    id: 'servicing_and_scoping',
    label: 'Servicing and on-Country scoping',
    weight: 3,
    terms: ['community consultation', 'feasibility', 'technical assistance', 'maintenance', 'repair', 'site scoping', 'planning', 'travel'],
  },
  {
    id: 'employment_pathways',
    label: 'First Nations employment and training',
    weight: 4,
    terms: ['employment', 'jobs', 'workforce', 'training', 'apprentice', 'enterprise development', 'economic development', 'job readiness'],
  },
  {
    id: 'circular_manufacturing',
    label: 'Circular manufacturing',
    weight: 4,
    terms: ['circular economy', 'recycled plastic', 'recycling', 'waste reduction', 'manufacturing', 'productive equipment', 'machinery'],
  },
  {
    id: 'remote_community_infrastructure',
    label: 'Remote community infrastructure',
    weight: 4,
    terms: ['remote community', 'remote communities', 'community infrastructure', 'aboriginal housing', 'remote housing', 'community controlled'],
  },
];

const CONTEXT_TERMS = {
  first_nations: ['first nations', 'indigenous', 'aboriginal', 'torres strait', 'traditional owner'],
  remote: ['remote', 'regional', 'rural', 'northern territory', ' nt ', 'on-country', 'on country'],
  health: ['health', 'wellbeing', 'hygiene', 'washing', 'disease prevention', 'healthy homes'],
  community_led: ['community-led', 'community led', 'self-determination', 'community controlled', 'locally led'],
};

const DOORWAY_RULES = [
  ['trustee_application', ['perpetual', 'equity trustees', 'australian executor trustees', 'state trustees']],
  ['corporate_community_investment', ['community investment', 'community partnership', 'sponsorship', 'corporate foundation']],
  ['open_application', ['applications open', 'apply now', 'open round', 'open program']],
  ['invitation_or_relationship', ['invitation only', 'by invitation', 'relationship-led', 'relationship led']],
];

function normalise(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchedTerms(text, terms) {
  return terms.filter(term => text.includes(term));
}

export function scoreAnalogue(row) {
  const text = normalise([
    row.grantee_name,
    row.program_name,
    row.evidence_text,
    row.grantee_sector,
    row.foundation_name,
    ...(row.thematic_focus ?? []),
    ...(row.geographic_focus ?? []),
  ].flat().join(' '));

  const blockMatches = BLOCKS.map(block => ({
    id: block.id,
    label: block.label,
    hits: matchedTerms(text, block.terms),
    score: matchedTerms(text, block.terms).length * block.weight,
  })).filter(match => match.hits.length > 0);

  // Evidence quality alone is not project relevance. Requiring a named block
  // prevents well-documented scholarships and medical research grants from
  // entering the neighbourhood simply because they have URLs and amounts.
  if (blockMatches.length === 0) return { score: 0, blockMatches: [], contextMatches: [] };

  const contextMatches = Object.entries(CONTEXT_TERMS).map(([id, terms]) => ({
    id,
    hits: matchedTerms(text, terms),
  })).filter(match => match.hits.length > 0);

  const contextScore = contextMatches.reduce((sum, match) => sum + Math.min(match.hits.length, 2) * 4, 0);
  const evidenceScore = row.source_url || row.source_document_url ? 8 : 0;
  const amountScore = Number(row.grant_amount) > 0 ? 4 : 0;
  const entityScore = row.grantee_entity_id ? 3 : 0;
  const breadthScore = Math.min(blockMatches.length, 3) * 4;
  const score = Math.min(100, blockMatches.reduce((sum, match) => sum + match.score, 0) + contextScore + evidenceScore + amountScore + entityScore + breadthScore);

  return { score, blockMatches, contextMatches };
}

export function classifyDoorway(row) {
  const text = normalise([
    row.foundation_name,
    row.foundation_type,
    row.parent_company,
    row.application_mode,
    row.program_status,
    row.program_description,
  ].join(' '));

  for (const [doorway, terms] of DOORWAY_RULES) {
    if (terms.some(term => text.includes(term))) return doorway;
  }
  if (row.application_mode) return normalise(row.application_mode).replace(/\s+/g, '_');
  if (row.program_url) return 'published_program';
  return 'relationship_research';
}

export function aggregateFunders(scoredRows, engagedNames = []) {
  const engaged = engagedNames.map(normalise);
  const grouped = new Map();

  for (const row of scoredRows) {
    const foundationName = normalise(row.foundation_name)
      .replace(/\b(the|trustee|for|foundation|limited|ltd|incorporated|inc|trust|fund)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const granteeName = normalise(row.grantee_name)
      .replace(/\b(the|trustee|for|foundation|limited|ltd|incorporated|inc|trust|fund)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (foundationName && granteeName && foundationName === granteeName) continue;
    const result = scoreAnalogue(row);
    if (result.score === 0) continue;
    const current = grouped.get(row.foundation_id) ?? {
      foundation_id: row.foundation_id,
      foundation_name: row.foundation_name,
      website: row.foundation_website,
      doorway: classifyDoorway(row),
      analogues: [],
      blockIds: new Set(),
      evidenceUrls: new Set(),
      totalRecordedGiving: 0,
    };
    current.analogues.push({ ...row, ...result });
    result.blockMatches.forEach(match => current.blockIds.add(match.id));
    if (row.source_url) current.evidenceUrls.add(row.source_url);
    if (row.source_document_url) current.evidenceUrls.add(row.source_document_url);
    current.totalRecordedGiving += Number(row.grant_amount) || 0;
    grouped.set(row.foundation_id, current);
  }

  return [...grouped.values()].map(funder => {
    funder.analogues.sort((a, b) => b.score - a.score);
    const name = normalise(funder.foundation_name);
    const alreadyEngaged = engaged.some(term => term && (name.includes(term) || term.includes(name)));
    const topScores = funder.analogues.slice(0, 3).map(row => row.score);
    const score = Math.max(0, Math.min(100,
      Math.round(topScores.reduce((sum, value) => sum + value, 0) / topScores.length)
      + Math.min(funder.analogues.length, 5) * 3
      + Math.min(funder.blockIds.size, 3) * 4
      - (alreadyEngaged ? 25 : 0)
    ));
    return {
      ...funder,
      score,
      alreadyEngaged,
      blockIds: [...funder.blockIds],
      evidenceUrls: [...funder.evidenceUrls],
    };
  }).sort((a, b) => b.score - a.score || b.analogues.length - a.analogues.length);
}

export const recipientNeighbourhoodBlocks = BLOCKS;

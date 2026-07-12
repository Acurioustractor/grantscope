export interface ActOpportunityProjectOption {
  code: string;
  name: string;
  slug: string;
}

export interface ActOpportunityProjectSignal {
  title: string;
  summary: string;
  project: string;
  projectCode: string;
  tags: string[];
}

const PROJECT_ALIASES: Record<string, string[]> = {
  goods: ['essential goods', 'circular materials', 'remote housing', 'procurement', 'supply chain'],
  justicehub: ['justicehub', 'youth justice', 'diversion', 'reintegration', 'justice reform'],
  harvest: ['green harvest', 'regenerative agriculture', 'horticulture', 'witta'],
  'empathy-ledger': ['empathy ledger', 'community voice', 'data sovereignty', 'consent infrastructure'],
  civicgraph: ['civicgraph', 'grantscope', 'funding intelligence', 'accountability atlas'],
  picc: ['palm island', 'picc'],
  alma: ['australian living map', 'living map of alternatives'],
  contained: ['contained'],
  'station-precinct': ['station precinct'],
  'elders-room': ['elders room'],
};

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function phraseMatches(haystack: string, phrase: string): boolean {
  const value = normalise(phrase);
  return value.length > 2 && (` ${haystack} `).includes(` ${value} `);
}

/** Resolve only strong project signals. Ambiguous opportunities stay unassigned for human choice. */
export function resolveActOpportunityProject(
  record: ActOpportunityProjectSignal,
  projects: ActOpportunityProjectOption[],
): ActOpportunityProjectOption | null {
  const explicitCode = normalise(record.projectCode);
  if (explicitCode && explicitCode !== 'act') {
    const directCode = projects.find((project) => normalise(project.code) === explicitCode);
    if (directCode) return directCode;
  }

  const projectLabel = normalise(record.project);
  if (projectLabel && projectLabel !== 'act' && projectLabel !== 'a curious tractor') {
    const directLabel = projects.find((project) =>
      [project.name, project.slug, project.code].some((value) => normalise(value) === projectLabel),
    );
    if (directLabel) return directLabel;
  }

  const haystack = normalise([record.title, record.summary, record.project, ...record.tags].join(' '));
  const ranked = projects
    .map((project) => {
      const exactPhrases = [project.name, project.slug];
      const aliases = PROJECT_ALIASES[project.slug] ?? [];
      const exactScore = exactPhrases.reduce((score, phrase) => score + (phraseMatches(haystack, phrase) ? 10 : 0), 0);
      const aliasScore = aliases.reduce((score, phrase) => score + (phraseMatches(haystack, phrase) ? 5 : 0), 0);
      return { project, score: exactScore + aliasScore };
    })
    .sort((left, right) => right.score - left.score || left.project.name.localeCompare(right.project.name));

  return ranked[0]?.score >= 5 && ranked[0].score > (ranked[1]?.score ?? 0) ? ranked[0].project : null;
}

export function actionCreatesPipeline(kind: string): boolean {
  return kind === 'research' || kind === 'partner_path' || kind === 'apply_path';
}

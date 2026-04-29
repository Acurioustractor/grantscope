export type NavItem = {
  label: string;
  href: string;
  status?: ReportStatus;
  note?: string;
  children?: NavItem[];
};

export type ReportStatus = 'current' | 'reference' | 'review' | 'archive';

export const reportStatusMeta: Record<ReportStatus, { label: string; description: string }> = {
  current: {
    label: 'Current',
    description: 'Use this as an active operating surface or current narrative.',
  },
  reference: {
    label: 'Reference',
    description: 'Useful context, but not the main decision surface.',
  },
  review: {
    label: 'Review',
    description: 'Needs source-date, figure, and framing review before quoting externally.',
  },
  archive: {
    label: 'Archive',
    description: 'Background material only. Do not treat as current without rewriting.',
  },
};

export type NavSection = {
  title: string;
  description?: string;
  items: NavItem[];
};

/** Reusable state-level children for any domain */
function stateChildren(domain: string): NavItem[] {
  return [
    { label: 'ACT', href: `/reports/${domain}/act` },
    { label: 'NSW', href: `/reports/${domain}/nsw` },
    { label: 'NT', href: `/reports/${domain}/nt` },
    { label: 'QLD', href: `/reports/${domain}/qld` },
    { label: 'SA', href: `/reports/${domain}/sa` },
    { label: 'TAS', href: `/reports/${domain}/tas` },
    { label: 'VIC', href: `/reports/${domain}/vic` },
    { label: 'WA', href: `/reports/${domain}/wa` },
  ];
}

export const reportSections: NavSection[] = [
  {
    title: 'Current Map',
    description: 'Start here: aligned, useful surfaces for decisions',
    items: [
      { label: 'State of the Nation', href: '/reports/state-of-the-nation', status: 'current' },
      { label: 'Grant Frontier', href: '/reports/grant-frontier', status: 'current' },
      { label: 'Funding Equity', href: '/reports/funding-equity', status: 'current' },
      { label: 'Foundation Intelligence', href: '/reports/philanthropy', status: 'current' },
      { label: 'Social Enterprise', href: '/reports/social-enterprise', status: 'current' },
      { label: 'Reallocation Atlas', href: '/reports/reallocation-atlas', status: 'current' },
      { label: 'Youth Justice Tracker', href: '/reports/youth-justice/qld/tracker', status: 'current' },
    ],
  },
  {
    title: 'State Dashboards',
    description: 'Cross-domain intelligence by jurisdiction',
    items: [
      { label: 'ACT', href: '/reports/act', status: 'reference' },
      { label: 'NSW', href: '/reports/nsw', status: 'reference' },
      { label: 'NT', href: '/reports/nt', status: 'reference' },
      { label: 'QLD', href: '/reports/qld', status: 'reference' },
      { label: 'SA', href: '/reports/sa', status: 'reference' },
      { label: 'TAS', href: '/reports/tas', status: 'reference' },
      { label: 'VIC', href: '/reports/vic', status: 'reference' },
      { label: 'WA', href: '/reports/wa', status: 'reference' },
    ],
  },
  {
    title: 'Youth Justice',
    description: 'Who gets locked up, who profits, what works',
    items: [
      { label: 'Overview', href: '/reports/youth-justice', status: 'current' },
      { label: 'National Comparison', href: '/reports/youth-justice/national', status: 'reference' },
      {
        label: 'States & Territories',
        href: '/reports/youth-justice/act',
        status: 'reference',
        children: [
          { label: 'ACT', href: '/reports/youth-justice/act' },
          { label: 'NSW', href: '/reports/youth-justice/nsw' },
          { label: 'NT', href: '/reports/youth-justice/nt' },
          {
            label: 'QLD',
            href: '/reports/youth-justice/qld',
            status: 'current',
            children: [
              { label: 'Overview', href: '/reports/youth-justice/qld', status: 'current' },
              { label: 'Announcement Register', href: '/reports/youth-justice/qld/announcements', status: 'current' },
              { label: 'Supplier Map', href: '/reports/youth-justice/qld/announcements/services', status: 'current' },
              { label: 'Evidence Trackers', href: '/reports/youth-justice/qld/trackers', status: 'current' },
              { label: 'Watch-house Data', href: '/reports/youth-justice/qld/watchhouse-data', status: 'current' },
              { label: 'Schools Tracker', href: '/reports/youth-justice/qld/tracker', status: 'current' },
              { label: 'Crime Prevention Schools', href: '/reports/youth-justice/qld/crime-prevention-schools', status: 'current' },
            ],
          },
          { label: 'SA', href: '/reports/youth-justice/sa' },
          { label: 'TAS', href: '/reports/youth-justice/tas' },
          { label: 'VIC', href: '/reports/youth-justice/vic' },
          { label: 'WA', href: '/reports/youth-justice/wa' },
        ],
      },
      { label: 'Alice Springs', href: '/reports/youth-justice/alice-springs', status: 'reference' },
    ],
  },
  {
    title: 'Child Protection',
    description: 'Out-of-home care, family safety, the pipeline',
    items: [
      { label: 'Overview', href: '/reports/child-protection', status: 'reference' },
      { label: 'National Comparison', href: '/reports/child-protection/national', status: 'reference' },
      {
        label: 'States & Territories',
        href: '/reports/child-protection/act',
        status: 'reference',
        children: stateChildren('child-protection'),
      },
    ],
  },
  {
    title: 'Disability',
    description: 'NDIS markets, thin supply, who delivers',
    items: [
      { label: 'Overview', href: '/reports/disability', status: 'reference' },
      { label: 'The Disability Dollar', href: '/reports/ndis', status: 'review' },
      { label: 'NDIS Market', href: '/reports/ndis-market', status: 'reference' },
      { label: 'National Comparison', href: '/reports/disability/national', status: 'reference' },
      {
        label: 'States & Territories',
        href: '/reports/disability/act',
        status: 'reference',
        children: stateChildren('disability'),
      },
    ],
  },
  {
    title: 'Education',
    description: 'Schools, funding, outcomes, and the crossover',
    items: [
      { label: 'Overview', href: '/reports/education', status: 'reference' },
      { label: 'National Comparison', href: '/reports/education/national', status: 'reference' },
      {
        label: 'States & Territories',
        href: '/reports/education/act',
        status: 'reference',
        children: stateChildren('education'),
      },
    ],
  },
  {
    title: 'Cross-System',
    description: 'Where every system meets the same communities',
    items: [
      { label: 'Convergence', href: '/reports/convergence', status: 'current' },
      { label: 'Reality Check', href: '/reports/reality-check', status: 'review' },
    ],
  },
  {
    title: 'Accountability & Power',
    description: 'Who controls the levers and how they overlap',
    items: [
      { label: 'Power Concentration', href: '/reports/power-concentration', status: 'review' },
      { label: 'Board Interlocks', href: '/reports/board-interlocks', status: 'review' },
      { label: 'Who Runs Australia', href: '/reports/who-runs-australia', status: 'review' },
      { label: 'Political Money', href: '/reports/political-money', status: 'review' },
      { label: 'Donor-Contractors', href: '/reports/donor-contractors', status: 'review' },
      { label: 'Influence Network', href: '/reports/influence-network', status: 'review' },
      { label: 'Power Network', href: '/reports/power-network', status: 'review' },
      { label: 'Triple Play', href: '/reports/triple-play', status: 'review' },
      { label: 'Cross-Reference', href: '/reports/cross-reference', status: 'review' },
      { label: 'Power Dynamics', href: '/reports/power-dynamics', status: 'current' },
      { label: 'Power Map', href: '/reports/power-map', status: 'reference' },
      { label: 'Timing', href: '/reports/timing', status: 'review' },
    ],
  },
  {
    title: 'Funding & Equity',
    description: 'Where money flows — and where it doesn\'t',
    items: [
      { label: 'Funding Equity', href: '/reports/funding-equity', status: 'current' },
      { label: 'Funding Deserts', href: '/reports/funding-deserts', status: 'review' },
      { label: 'Access Gap', href: '/reports/access-gap', status: 'reference' },
      { label: 'Money Flow', href: '/reports/money-flow', status: 'reference' },
      { label: 'Desert Overhead', href: '/reports/desert-overhead', status: 'review' },
      { label: 'Community Efficiency', href: '/reports/community-efficiency', status: 'review' },
    ],
  },
  {
    title: 'Social Sector',
    description: 'Community organisations and service delivery',
    items: [
      { label: 'Community Power', href: '/reports/community-power', status: 'current' },
      { label: 'Community Parity', href: '/reports/community-parity', status: 'current' },
      { label: 'Social Enterprise', href: '/reports/social-enterprise', status: 'current' },
      {
        label: 'Multicultural Sector', href: '/reports/multicultural-sector', status: 'current', note: 'FECCA + 21 ethnic communities councils',
        children: [
          { label: 'FECCA + ECCV deep dive', href: '/reports/multicultural-sector/fecca-eccv', status: 'current' },
        ],
      },
    ],
  },
  {
    title: 'Philanthropy & Corporate',
    description: 'Private wealth in the public interest',
    items: [
      { label: 'Big Philanthropy', href: '/reports/big-philanthropy', status: 'current' },
      { label: 'Philanthropy', href: '/reports/philanthropy', status: 'current' },
      { label: 'Charity Contracts', href: '/reports/charity-contracts', status: 'review' },
      { label: 'Exec Remuneration', href: '/reports/exec-remuneration', status: 'review' },
      { label: 'Tax Transparency', href: '/reports/tax-transparency', status: 'reference' },
    ],
  },
  {
    title: 'Research & Procurement',
    description: 'Where government money goes beyond social services',
    items: [
      { label: 'Research Funding', href: '/reports/research-funding', status: 'review' },
      { label: 'State Procurement', href: '/reports/state-procurement', status: 'review' },
    ],
  },
  {
    title: 'Data & System',
    description: 'The infrastructure underneath',
    items: [
      { label: 'State of the Nation', href: '/reports/state-of-the-nation', status: 'current' },
      { label: 'Data Quality', href: '/reports/data-quality', status: 'review' },
      { label: 'Data Health', href: '/reports/data-health', status: 'reference' },
      { label: 'Entity Intelligence', href: '/reports/picc', status: 'reference' },
    ],
  },
];

export function findReportItem(pathname: string): NavItem | null {
  for (const section of reportSections) {
    const item = findInItems(section.items, pathname);
    if (item) return item;
  }
  return null;
}

function findInItems(items: NavItem[], pathname: string): NavItem | null {
  for (const item of items) {
    if (item.href === pathname) return item;
    if (item.children) {
      const child = findInItems(item.children, pathname);
      if (child) return child;
    }
  }
  return null;
}

export const bottomLinks: NavItem[] = [
  { label: 'Graph', href: '/graph' },
  { label: 'Map', href: '/map' },
];

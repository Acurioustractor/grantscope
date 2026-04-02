export type NavItem = {
  label: string;
  href: string;
  children?: NavItem[];
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
    title: 'State Dashboards',
    description: 'Cross-domain intelligence by jurisdiction',
    items: [
      { label: 'ACT', href: '/reports/act' },
      { label: 'NSW', href: '/reports/nsw' },
      { label: 'NT', href: '/reports/nt' },
      { label: 'QLD', href: '/reports/qld' },
      { label: 'SA', href: '/reports/sa' },
      { label: 'TAS', href: '/reports/tas' },
      { label: 'VIC', href: '/reports/vic' },
      { label: 'WA', href: '/reports/wa' },
    ],
  },
  {
    title: 'Youth Justice',
    description: 'Who gets locked up, who profits, what works',
    items: [
      { label: 'Overview', href: '/reports/youth-justice' },
      { label: 'National Comparison', href: '/reports/youth-justice/national' },
      {
        label: 'States & Territories',
        href: '/reports/youth-justice/act',
        children: [
          { label: 'ACT', href: '/reports/youth-justice/act' },
          { label: 'NSW', href: '/reports/youth-justice/nsw' },
          { label: 'NT', href: '/reports/youth-justice/nt' },
          {
            label: 'QLD',
            href: '/reports/youth-justice/qld',
            children: [{ label: 'Tracker', href: '/reports/youth-justice/qld/tracker' }],
          },
          { label: 'SA', href: '/reports/youth-justice/sa' },
          { label: 'TAS', href: '/reports/youth-justice/tas' },
          { label: 'VIC', href: '/reports/youth-justice/vic' },
          { label: 'WA', href: '/reports/youth-justice/wa' },
        ],
      },
      { label: 'Alice Springs', href: '/reports/youth-justice/alice-springs' },
    ],
  },
  {
    title: 'Child Protection',
    description: 'Out-of-home care, family safety, the pipeline',
    items: [
      { label: 'Overview', href: '/reports/child-protection' },
      { label: 'National Comparison', href: '/reports/child-protection/national' },
      {
        label: 'States & Territories',
        href: '/reports/child-protection/act',
        children: stateChildren('child-protection'),
      },
    ],
  },
  {
    title: 'Disability',
    description: 'NDIS markets, thin supply, who delivers',
    items: [
      { label: 'Overview', href: '/reports/disability' },
      { label: 'The Disability Dollar', href: '/reports/ndis' },
      { label: 'NDIS Market', href: '/reports/ndis-market' },
      { label: 'National Comparison', href: '/reports/disability/national' },
      {
        label: 'States & Territories',
        href: '/reports/disability/act',
        children: stateChildren('disability'),
      },
    ],
  },
  {
    title: 'Education',
    description: 'Schools, funding, outcomes, and the crossover',
    items: [
      { label: 'Overview', href: '/reports/education' },
      { label: 'National Comparison', href: '/reports/education/national' },
      {
        label: 'States & Territories',
        href: '/reports/education/act',
        children: stateChildren('education'),
      },
    ],
  },
  {
    title: 'Cross-System',
    description: 'Where every system meets the same communities',
    items: [
      { label: 'Convergence', href: '/reports/convergence' },
      { label: 'Reality Check', href: '/reports/reality-check' },
    ],
  },
  {
    title: 'Accountability & Power',
    description: 'Who controls the levers and how they overlap',
    items: [
      { label: 'Power Concentration', href: '/reports/power-concentration' },
      { label: 'Board Interlocks', href: '/reports/board-interlocks' },
      { label: 'Who Runs Australia', href: '/reports/who-runs-australia' },
      { label: 'Political Money', href: '/reports/political-money' },
      { label: 'Donor-Contractors', href: '/reports/donor-contractors' },
      { label: 'Influence Network', href: '/reports/influence-network' },
      { label: 'Power Network', href: '/reports/power-network' },
      { label: 'Triple Play', href: '/reports/triple-play' },
      { label: 'Cross-Reference', href: '/reports/cross-reference' },
      { label: 'Power Dynamics', href: '/reports/power-dynamics' },
      { label: 'Power Map', href: '/reports/power-map' },
      { label: 'Timing', href: '/reports/timing' },
    ],
  },
  {
    title: 'Funding & Equity',
    description: 'Where money flows — and where it doesn\'t',
    items: [
      { label: 'Funding Equity', href: '/reports/funding-equity' },
      { label: 'Funding Deserts', href: '/reports/funding-deserts' },
      { label: 'Access Gap', href: '/reports/access-gap' },
      { label: 'Money Flow', href: '/reports/money-flow' },
      { label: 'Desert Overhead', href: '/reports/desert-overhead' },
      { label: 'Community Efficiency', href: '/reports/community-efficiency' },
    ],
  },
  {
    title: 'Social Sector',
    description: 'Community organisations and service delivery',
    items: [
      { label: 'Community Power', href: '/reports/community-power' },
      { label: 'Community Parity', href: '/reports/community-parity' },
      { label: 'Social Enterprise', href: '/reports/social-enterprise' },
    ],
  },
  {
    title: 'Philanthropy & Corporate',
    description: 'Private wealth in the public interest',
    items: [
      { label: 'Big Philanthropy', href: '/reports/big-philanthropy' },
      { label: 'Philanthropy', href: '/reports/philanthropy' },
      { label: 'Charity Contracts', href: '/reports/charity-contracts' },
      { label: 'Exec Remuneration', href: '/reports/exec-remuneration' },
      { label: 'Tax Transparency', href: '/reports/tax-transparency' },
    ],
  },
  {
    title: 'Research & Procurement',
    description: 'Where government money goes beyond social services',
    items: [
      { label: 'Research Funding', href: '/reports/research-funding' },
      { label: 'State Procurement', href: '/reports/state-procurement' },
    ],
  },
  {
    title: 'Data & System',
    description: 'The infrastructure underneath',
    items: [
      { label: 'State of the Nation', href: '/reports/state-of-the-nation' },
      { label: 'Data Quality', href: '/reports/data-quality' },
      { label: 'Data Health', href: '/reports/data-health' },
      { label: 'Entity Intelligence', href: '/reports/picc' },
    ],
  },
];

export const bottomLinks: NavItem[] = [
  { label: 'Graph', href: '/graph' },
  { label: 'Map', href: '/map' },
];

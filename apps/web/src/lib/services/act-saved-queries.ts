import { getDirectServiceSupabase } from '@/lib/supabase';
import { applyGrantFilters, isRealRecipient } from '@/lib/justice-money';

/**
 * Saved parameterised queries — slice I of the console plan.
 *
 * The questions ACT actually asks, written once, audited once, re-run with your inputs, with the
 * mandatory money filters baked in so they cannot be forgotten. This is the deliberate opposite
 * of free-text querying, which was ruled out twice: an ad-hoc answer carries no caveat, no
 * coverage note and no exclusions, and a funder email quoting a number from an unaudited query is
 * the failure this system exists to prevent. Every result here travels with its caveats.
 *
 * Parameters are allowlists or shape-validated scalars only. There is no path from user input to
 * SQL text — everything goes through PostgREST builder filters.
 */

export type ParamDef =
  | { name: string; label: string; kind: 'choice'; options: readonly { value: string; label: string }[]; required: boolean }
  | { name: string; label: string; kind: 'abn'; required: boolean };

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
  /** One-line statement of what the number IS. Rendered above the rows, always. */
  summary: string;
  /** The caveats travel with the result. Never optional. */
  caveats: string[];
}

export interface SavedQuery {
  key: string;
  title: string;
  question: string;
  params: ParamDef[];
  caveats: string[];
  run(params: Record<string, string>): Promise<QueryResult>;
}

/** Measured against the live table 2026-08-16 — the nine tags that exist, no more. */
const TOPICS = [
  { value: 'child-protection', label: 'Child protection' },
  { value: 'family-services', label: 'Family services' },
  { value: 'ndis', label: 'NDIS' },
  { value: 'youth-justice', label: 'Youth justice' },
  { value: 'indigenous', label: 'Indigenous' },
  { value: 'community-led', label: 'Community-led' },
  { value: 'diversion', label: 'Diversion' },
  { value: 'legal-services', label: 'Legal services' },
  { value: 'prevention', label: 'Prevention' },
] as const;

const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'].map((s) => ({ value: s, label: s }));

const WINDOWS = [
  { value: '30', label: 'Next 30 days' },
  { value: '60', label: 'Next 60 days' },
  { value: '90', label: 'Next 90 days' },
] as const;

const nf = new Intl.NumberFormat('en-AU');
const money = (n: number) => `$${nf.format(Math.round(n))}`;

function cleanAbn(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\s/g, '');
  return /^\d{11}$/.test(digits) ? digits : null;
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
}

// ── 1. Recorded grants in a topic ────────────────────────────────────────────

const GRANT_CAVEATS = [
  'A floor, never a total: only 19.7% of the largest grant register (qgip) is topic-tagged, so untagged grants in this topic exist and are not counted.',
  "Whole-of-state budget rows (measure_kind ≠ 'grant'), aggregate rows and spreadsheet-total recipient names are excluded — nationally that strips $12.12bn of non-organisation money.",
  'Rows with no dollar amount are counted in grant counts but contribute $0.',
];

const topicMoney: SavedQuery = {
  key: 'topic-money',
  title: 'Recorded grants in a topic',
  question: 'How much recorded grant money went to organisations in a topic, and to whom?',
  params: [
    { name: 'topic', label: 'Topic', kind: 'choice', options: TOPICS, required: true },
    { name: 'state', label: 'State', kind: 'choice', options: [{ value: '', label: 'All states' }, ...STATES], required: false },
  ],
  caveats: GRANT_CAVEATS,
  async run(params) {
    const topic = TOPICS.find((t) => t.value === params.topic)?.value;
    if (!topic) throw new Error('Pick a topic.');
    const state = STATES.find((s) => s.value === params.state)?.value ?? null;

    const db = getDirectServiceSupabase();
    interface Row { recipient_name: string | null; amount_dollars: number | null; gs_entity_id: string | null }
    const rows = await fetchAll<Row>((from, to) => {
      let q = applyGrantFilters(
        db.from('justice_funding').select('recipient_name,amount_dollars,gs_entity_id'),
      ).contains('topics', [topic]);
      if (state) q = q.eq('state', state);
      return q.range(from, to);
    });

    const real = rows.filter((r) => isRealRecipient(r.recipient_name));
    const excluded = rows.length - real.length;
    const byName = new Map<string, { dollars: number; grants: number }>();
    let total = 0;
    for (const r of real) {
      const name = r.recipient_name!.trim();
      const agg = byName.get(name) ?? { dollars: 0, grants: 0 };
      agg.dollars += r.amount_dollars ?? 0;
      agg.grants += 1;
      byName.set(name, agg);
      total += r.amount_dollars ?? 0;
    }
    const top = [...byName.entries()].sort((a, b) => b[1].dollars - a[1].dollars).slice(0, 25);

    return {
      columns: ['Recipient', 'Grants', 'Dollars'],
      rows: top.map(([name, agg]) => [name, agg.grants, money(agg.dollars)]),
      summary: `${money(total)} across ${nf.format(real.length)} grants to ${nf.format(byName.size)} organisations — ${TOPICS.find((t) => t.value === topic)!.label}${state ? `, ${state}` : ', all states'}. Top 25 shown.`,
      caveats: [
        ...GRANT_CAVEATS,
        excluded > 0 ? `${excluded} aggregate-shaped recipient rows were excluded from this result.` : 'No aggregate-shaped recipient rows were present in this result.',
      ],
    };
  },
};

// ── 2. Money attached to an ABN ───────────────────────────────────────────────

const whoFunds: SavedQuery = {
  key: 'abn-money',
  title: 'Money attached to an ABN',
  question: 'What recorded grants, contracts and political donations attach to one ABN?',
  params: [{ name: 'abn', label: 'ABN (11 digits)', kind: 'abn', required: true }],
  caveats: [
    'Three registers, three directions: grants are money TO the entity, contracts are money TO it, donations are money FROM it.',
    "Donations count only receipt_type = 'donation received' — the 'other receipt' category is 72% of AEC rows and is not donations.",
    'ABN joins miss anything recorded without an ABN. Absence here is absence from the registers, not proof of absence.',
  ],
  async run(params) {
    const abn = cleanAbn(params.abn);
    if (!abn) throw new Error('Enter an 11-digit ABN.');

    const db = getDirectServiceSupabase();
    interface Amt { amount_dollars?: number | null; contract_value?: number | null; amount?: number | null }
    const [grants, contracts, donations] = await Promise.all([
      fetchAll<Amt>((from, to) =>
        applyGrantFilters(db.from('justice_funding').select('amount_dollars')).eq('recipient_abn', abn).range(from, to),
      ),
      fetchAll<Amt>((from, to) =>
        db.from('austender_contracts').select('contract_value').eq('supplier_abn', abn).range(from, to),
      ),
      fetchAll<Amt>((from, to) =>
        db
          .from('political_donations')
          .select('amount')
          .eq('donor_abn', abn)
          .eq('receipt_type', 'donation received')
          .range(from, to),
      ),
    ]);

    const sum = (rows: Amt[], key: keyof Amt) => rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
    const rows: (string | number | null)[][] = [
      ['Recorded grants (to)', grants.length, money(sum(grants, 'amount_dollars'))],
      ['Government contracts (to)', contracts.length, money(sum(contracts, 'contract_value'))],
      ['Political donations (from)', donations.length, money(sum(donations, 'amount'))],
    ];
    return {
      columns: ['Register', 'Rows', 'Dollars'],
      rows,
      summary: `ABN ${abn} across three registers.`,
      caveats: whoFunds.caveats,
    };
  },
};

// ── 3. Grant opportunities closing soon ──────────────────────────────────────

const closingSoon: SavedQuery = {
  key: 'closing-soon',
  title: 'Grant opportunities closing soon',
  question: 'Which open grant opportunities close within the window?',
  params: [{ name: 'days', label: 'Window', kind: 'choice', options: WINDOWS, required: true }],
  caveats: [
    'Deadline-ordered on purpose. Fit scores are deliberately not used: audited 2026-06, high fit_score funders carry placeholder giving figures and rank as noise.',
    'Only opportunities with a recorded deadline appear. Rolling or undated programs are absent, not closed.',
  ],
  async run(params) {
    const days = WINDOWS.find((w) => w.value === params.days)?.value;
    if (!days) throw new Error('Pick a window.');
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + Number(days) * 86400_000).toISOString().slice(0, 10);

    const db = getDirectServiceSupabase();
    const { data, error } = await db
      .from('grant_opportunities')
      .select('name, amount_min, amount_max, deadline, source, categories')
      .gte('deadline', today)
      .lte('deadline', until)
      .order('deadline', { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);

    interface Opp { name: string; amount_min: number | null; amount_max: number | null; deadline: string; source: string | null; categories: string[] | null }
    const opps = (data ?? []) as unknown as Opp[];
    return {
      columns: ['Closes', 'Opportunity', 'Amount', 'Source', 'Categories'],
      rows: opps.map((o) => [
        o.deadline,
        o.name,
        o.amount_max || o.amount_min ? `${o.amount_min ? money(o.amount_min) : ''}${o.amount_min && o.amount_max ? '–' : ''}${o.amount_max ? money(o.amount_max) : ''}` : '—',
        o.source,
        o.categories?.slice(0, 3).join(', ') ?? null,
      ]),
      summary: `${opps.length}${opps.length === 50 ? '+' : ''} opportunities close between ${today} and ${until}. Earliest first.`,
      caveats: closingSoon.caveats,
    };
  },
};

// ── 4. Community-controlled organisations by place ───────────────────────────

const communityControlled: SavedQuery = {
  key: 'community-controlled',
  title: 'Community-controlled organisations by place',
  question: 'How many community-controlled organisations does the graph hold in a state, by remoteness?',
  params: [{ name: 'state', label: 'State', kind: 'choice', options: STATES, required: true }],
  caveats: [
    'Counts what the graph can PLACE. Entities without a resolvable location are deliberately unplaced rather than confidently wrong, and appear under "No remoteness recorded".',
    'is_community_controlled is a curated flag, not a register — treat as a floor.',
  ],
  async run(params) {
    const state = STATES.find((s) => s.value === params.state)?.value;
    if (!state) throw new Error('Pick a state.');

    const db = getDirectServiceSupabase();
    interface Row { remoteness: string | null }
    const rows = await fetchAll<Row>((from, to) =>
      db
        .from('gs_entities')
        .select('remoteness')
        .eq('is_community_controlled', true)
        .eq('state', state)
        .range(from, to),
    );
    const byRemoteness = new Map<string, number>();
    for (const r of rows) {
      const key = r.remoteness ?? 'No remoteness recorded';
      byRemoteness.set(key, (byRemoteness.get(key) ?? 0) + 1);
    }
    return {
      columns: ['Remoteness', 'Organisations'],
      rows: [...byRemoteness.entries()].sort((a, b) => b[1] - a[1]),
      summary: `${nf.format(rows.length)} community-controlled organisations recorded in ${state}.`,
      caveats: communityControlled.caveats,
    };
  },
};

export const SAVED_QUERIES: readonly SavedQuery[] = [topicMoney, whoFunds, closingSoon, communityControlled];

export function savedQueryByKey(key: string): SavedQuery | null {
  return SAVED_QUERIES.find((q) => q.key === key) ?? null;
}

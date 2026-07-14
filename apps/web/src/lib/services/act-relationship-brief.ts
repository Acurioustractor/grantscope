import type { ActFunderDossier, ActFunderPerson } from './act-funder-intelligence';
import type { ActRelationshipLedger, ActRelationshipLedgerItem } from './act-relationship-ledger';

const LEGAL_TOKENS = new Set(['the', 'pty', 'ltd', 'limited', 'inc', 'incorporated', 'company', 'corporation', 'trustee', 'for']);
const DIRECT_PERSON_SOURCES = new Set<ActFunderPerson['source']>(['contact', 'ghl', 'gmail', 'portfolio']);

export interface ActRelationshipBriefAction {
  id: string;
  title: string;
  detail: string;
  kind: 'money' | 'relationship' | 'introduction' | 'research';
}

export interface ActRelationshipBrief {
  ledgerItem: ActRelationshipLedgerItem | null;
  directPeople: ActFunderPerson[];
  researchPeople: ActFunderPerson[];
  lastKnownContactAt: string | null;
  actions: ActRelationshipBriefAction[];
  unknowns: string[];
}

function normaliseBriefIdentity(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token && !LEGAL_TOKENS.has(token))
    .join(' ')
    .trim();
}

function identityVariants(value: string | null | undefined): string[] {
  return [...new Set(String(value ?? '').split(/\s+[\/·]\s+/).map(normaliseBriefIdentity).filter(Boolean))];
}

export function briefRelationshipNamesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftVariants = identityVariants(left);
  const rightVariants = identityVariants(right);
  return leftVariants.some((leftValue) => rightVariants.some((rightValue) => leftValue === rightValue));
}

export function isDirectFunderPerson(person: ActFunderPerson): boolean {
  return DIRECT_PERSON_SOURCES.has(person.source);
}

export function findRelationshipLedgerItem(
  dossier: ActFunderDossier,
  ledger: ActRelationshipLedger | null | undefined,
): ActRelationshipLedgerItem | null {
  return ledger?.items.find((item) => briefRelationshipNamesMatch(dossier.name, item.organisation)) ?? null;
}

function newestDate(values: Array<string | null | undefined>): string | null {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
}

function humanise(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ');
}

function money(value: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value);
}

export function buildActRelationshipBrief(
  dossier: ActFunderDossier,
  ledger: ActRelationshipLedger | null | undefined,
): ActRelationshipBrief {
  const ledgerItem = findRelationshipLedgerItem(dossier, ledger);
  const directPeople = dossier.people.filter(isDirectFunderPerson);
  const researchPeople = dossier.people.filter((person) => !isDirectFunderPerson(person));
  const actions: ActRelationshipBriefAction[] = [];

  if (ledgerItem && ledgerItem.outstandingTotal > 0) {
    actions.push({
      id: 'outstanding-payment',
      title: `Follow up ${money(ledgerItem.outstandingTotal)} outstanding`,
      detail: ledgerItem.nextMove,
      kind: 'money',
    });
  }

  actions.push({
    id: 'relationship-move',
    title: dossier.nextStep || dossier.recommendedAction,
    detail: dossier.whyNow,
    kind: 'relationship',
  });

  const directPerson = directPeople[0];
  if (directPerson) {
    actions.push({
      id: `contact-${directPerson.id}`,
      title: `Follow up with ${directPerson.name}`,
      detail: `${directPerson.role ? `${humanise(directPerson.role)}. ` : ''}${directPerson.evidence}`,
      kind: 'introduction',
    });
  } else {
    const path = dossier.paths.find((candidate) => candidate.verified) ?? dossier.paths[0];
    if (path) {
      actions.push({
        id: `path-${path.id}`,
        title: `Test the ${humanise(path.kind)} route`,
        detail: `${path.label}: ${path.detail}`,
        kind: 'introduction',
      });
    }
  }

  const unknowns = [...new Set([
    ...dossier.evidenceGaps.map(humanise),
    ...(ledgerItem?.evidenceGaps.map(humanise) ?? []),
    ...(!ledgerItem ? ['ACT invoice, exchange, and conversation history is not yet linked to this organisation'] : []),
  ])];

  if (unknowns[0]) {
    actions.push({
      id: 'research-gap',
      title: `Find ${unknowns[0]}`,
      detail: 'Add the source and useful fact to this brief so the next approach starts with stronger context.',
      kind: 'research',
    });
  }

  return {
    ledgerItem,
    directPeople,
    researchPeople,
    lastKnownContactAt: newestDate([
      dossier.lastInteractionAt,
      ledgerItem?.lastContactAt,
      ...directPeople.map((person) => person.lastContactAt),
    ]),
    actions: actions.filter((action, index, all) => all.findIndex((candidate) => candidate.title === action.title) === index).slice(0, 4),
    unknowns,
  };
}

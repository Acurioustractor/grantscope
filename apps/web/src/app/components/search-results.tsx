'use client';

import type { ReactNode } from 'react';
import { money } from '@/lib/format';

/**
 * The typeahead result list, shared by the home search box (unified-search) and the rail's search
 * modal (global-search). Until 2026-09-24 each carried its own copy of these types, a local money
 * formatter and ~150 lines of identical rows, and the copies had already drifted: the rail's entity
 * row read `relationships` and `systems`, which neither /api/global-search nor /api/search/universal
 * returns, so it showed a state and nothing else.
 */

export interface EntityResult {
  type: 'entity';
  id: string;
  name: string;
  entityType: string;
  abn: string | null;
  state: string | null;
  sourceCount: number;
  revenue: number | null;
  href: string;
}

export interface FoundationResult {
  type: 'foundation';
  id: string;
  name: string;
  foundationType: string | null;
  abn: string | null;
  totalGiving: number | null;
  focus: string[] | null;
  href: string;
}

export interface GrantResult {
  type: 'grant';
  id: string;
  name: string;
  amountMin: number | null;
  amountMax: number | null;
  closesAt: string | null;
  programType: string | null;
  source: string | null;
  href: string;
}

export interface PersonResult {
  type?: 'person';
  name: string;
  boardCount: number;
  href: string;
}

export type SearchResult = EntityResult | PersonResult | FoundationResult | GrantResult;

export interface SearchResults {
  entities: EntityResult[];
  people: PersonResult[];
  foundations: FoundationResult[];
  grants: GrantResult[];
}

export const EMPTY_RESULTS: SearchResults = { entities: [], people: [], foundations: [], grants: [] };

// Every lane defaults to []: the route's lanes vary by scope, and spreading a missing one threw
// "searchResults.foundations is not iterable" on the first result (2026-09-23).
export function toSearchResults(data: Partial<Record<keyof SearchResults, unknown>>): SearchResults {
  const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
  return {
    entities: list<EntityResult>(data.entities),
    people: list<PersonResult>(data.people),
    foundations: list<FoundationResult>(data.foundations),
    grants: list<GrantResult>(data.grants),
  };
}

/** The results in the order the list renders them, which is the order the arrow keys walk. */
export function flatResults(r: SearchResults): SearchResult[] {
  return [...r.entities, ...r.people, ...r.foundations, ...r.grants];
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  charity: 'Charity', foundation: 'Foundation', company: 'Company',
  government_body: 'Govt', indigenous_corp: 'Indigenous Corp',
  political_party: 'Political Party', social_enterprise: 'Social Enterprise',
  trust: 'Trust', person: 'Person',
};

// /api/global-search sends the kind with spaces ("indigenous corp"), the universal route with
// underscores; both have to find the label.
function entityTypeLabel(type: string): string {
  return ENTITY_TYPE_LABELS[type.replace(/ /g, '_')] || type;
}

const BADGE: Record<string, string> = {
  entity: 'border-bauhaus-black/30 bg-bauhaus-canvas text-bauhaus-black',
  foundation: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
  grant: 'border-money bg-money-light text-money',
};

function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 border-2 uppercase tracking-widest ${BADGE[kind] ?? 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'}`}>
      {children}
    </span>
  );
}

function Section({ label, divider, children }: { label: string; divider: boolean; children: ReactNode }) {
  return (
    <div>
      <div className={`px-4 pt-3 pb-1${divider ? ' border-t-2 border-bauhaus-black/5' : ''}`}>
        <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">{label}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors cursor-pointer ${
        selected ? 'bg-bauhaus-canvas' : 'hover:bg-bauhaus-canvas/50'
      }`}
    >
      {children}
    </button>
  );
}

function grantRange(r: GrantResult): string | null {
  if (r.amountMin && r.amountMax) return `${money(r.amountMin)}-${money(r.amountMax)}`;
  const one = r.amountMax || r.amountMin;
  return one ? money(one) : null;
}

/**
 * The four result lanes. `offset` is how many selectable rows the caller renders above the list
 * (the rail's Views), so `selectedIndex` counts across both.
 */
export function SearchResultList({
  results,
  selectedIndex,
  onSelect,
  offset = 0,
}: {
  results: SearchResults;
  selectedIndex: number;
  onSelect: (href: string) => void;
  offset?: number;
}) {
  const start = {
    entities: offset,
    people: offset + results.entities.length,
    foundations: offset + results.entities.length + results.people.length,
    grants: offset + results.entities.length + results.people.length + results.foundations.length,
  };
  // A lane gets a rule above it when anything renders before it.
  const divider = (lane: keyof typeof start) => start[lane] > 0;

  return (
    <>
      {results.entities.length > 0 && (
        <Section label="Entities" divider={divider('entities')}>
          {results.entities.map((r, i) => (
            <Row key={r.id} selected={selectedIndex === start.entities + i} onClick={() => onSelect(r.href)}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-bauhaus-black truncate">{r.name}</div>
                <div className="text-[11px] text-bauhaus-muted font-medium">
                  {r.abn && <span>ABN {r.abn} &middot; </span>}
                  {r.state && <span>{r.state} &middot; </span>}
                  {r.sourceCount} source{r.sourceCount !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                {r.revenue ? <span className="text-xs font-black text-bauhaus-black">{money(r.revenue)}</span> : null}
                <Badge kind="entity">{entityTypeLabel(r.entityType)}</Badge>
              </div>
            </Row>
          ))}
        </Section>
      )}

      {results.people.length > 0 && (
        <Section label="People" divider={divider('people')}>
          {results.people.map((r, i) => (
            <Row key={`${r.name}-${i}`} selected={selectedIndex === start.people + i} onClick={() => onSelect(r.href)}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-bauhaus-black truncate">{r.name}</div>
                {r.boardCount > 0 && (
                  <div className="text-[11px] text-bauhaus-muted font-medium">
                    {r.boardCount} board seat{r.boardCount !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <span className="ml-3 shrink-0"><Badge kind="person">Person</Badge></span>
            </Row>
          ))}
        </Section>
      )}

      {results.foundations.length > 0 && (
        <Section label="Foundations" divider={divider('foundations')}>
          {results.foundations.map((r, i) => (
            <Row key={r.id} selected={selectedIndex === start.foundations + i} onClick={() => onSelect(r.href)}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-bauhaus-black truncate">{r.name}</div>
                <div className="text-[11px] text-bauhaus-muted font-medium">
                  {r.abn && <span>ABN {r.abn} &middot; </span>}
                  {r.focus?.slice(0, 2).join(', ')}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                {r.totalGiving ? <span className="text-xs font-black text-bauhaus-black">{money(r.totalGiving)}/yr</span> : null}
                <Badge kind="foundation">Foundation</Badge>
              </div>
            </Row>
          ))}
        </Section>
      )}

      {results.grants.length > 0 && (
        <Section label="Grants" divider={divider('grants')}>
          {results.grants.map((r, i) => {
            const range = grantRange(r);
            return (
              <Row key={r.id} selected={selectedIndex === start.grants + i} onClick={() => onSelect(r.href)}>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-bauhaus-black truncate">{r.name}</div>
                  <div className="text-[11px] text-bauhaus-muted font-medium">
                    {r.programType && <span>{r.programType} &middot; </span>}
                    {r.source && <span>{r.source} &middot; </span>}
                    {r.closesAt && <span>Closes {r.closesAt}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {range && <span className="text-xs font-black text-bauhaus-black">{range}</span>}
                  <Badge kind="grant">Grant</Badge>
                </div>
              </Row>
            );
          })}
        </Section>
      )}
    </>
  );
}

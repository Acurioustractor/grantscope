// How a placed organisation got its council — the placement stamps.
//
// Every gs_entities row WITH a council carries an lga_source stamp naming the
// evidence that placed it (the 2026-08 placement migrations; reasons.ts holds
// the codes for rows without a council). The Atlas reads them live so "placed"
// is never one flat count: the place panel says how sure each placement is,
// in plain words.
//
// Codes are two-part where the evidence and the authority differ:
// `<evidence>+<authority>` — e.g. acnc_street_line+sal_ratio_dominant is a
// charity-register street address resolved through ABS suburb/locality ratio
// dominance. The stamp is the provenance; it must never claim an authority
// that was not consulted (a gazetteer alias is not `+abs_asgs`).

export type StampFamilyKey = 'register-address' | 'register-town' | 'postcode' | 'own-name';

export interface StampFamily {
  key: StampFamilyKey;
  /** Plain words for the panel rollup. */
  label: string;
  /** One sentence on what this kind of evidence can and cannot promise. */
  note: string;
}

/** Ordered surest-evidence-first for the panel: an address names one place;
 * postcode geometry only says "almost certainly this council". */
export const STAMP_FAMILIES: readonly StampFamily[] = [
  {
    key: 'register-address',
    label: 'A register holds their address',
    note:
      'The address on a public register (business, charity or ORIC) resolves to this ' +
      'council. An office address is not always where the work happens.',
  },
  {
    key: 'register-town',
    label: 'A register names their town',
    note:
      'The town on the charity register resolves to this council. A town used as a ' +
      'postal address can serve communities well outside it.',
  },
  {
    key: 'own-name',
    label: 'Their own name names the place',
    note:
      'The organisation is named after a town or community that sits in this council, ' +
      'or is the council itself.',
  },
  {
    key: 'postcode',
    label: 'Their postcode decides it',
    note:
      'The postcode sits wholly — or at least nine-tenths — inside this council. The ' +
      'organisation itself could still be in the smaller remainder.',
  },
];

export interface PlacementStamp {
  /** The lga_source value exactly as stamped in the database. */
  code: string;
  /** Plain words — what a person in a room would say the evidence was. */
  label: string;
  family: StampFamilyKey;
}

/** Every stamp the database carries (verified live 2026-08-10), including the
 * 2026-08-09 additions: poa_ratio_nolocality, the sal_ratio_dominant forms of
 * own-name and ORIC addresses, the +gazetteer family, and the ACNC street
 * lines. */
export const PLACEMENT_STAMPS: readonly PlacementStamp[] = [
  // A register holds their address.
  { code: 'registry_address', label: 'registered address on the national business register', family: 'register-address' },
  { code: 'oric_register_address+abs_asgs', label: 'ORIC register address, resolved through ABS localities', family: 'register-address' },
  { code: 'oric_register_address+sal_ratio_dominant', label: 'ORIC register address; its suburb is almost wholly in this council', family: 'register-address' },
  { code: 'oric_register_address+gazetteer', label: 'ORIC register address, place resolved through a gazetteer alias', family: 'register-address' },
  { code: 'acnc_street_line+abs_asgs', label: 'charity register street address, resolved through ABS localities', family: 'register-address' },
  { code: 'acnc_street_line+sal_ratio_dominant', label: 'charity register street address; its suburb is almost wholly in this council', family: 'register-address' },
  // A register names their town.
  { code: 'acnc_town_city+abs_asgs', label: 'charity register town, resolved through ABS localities', family: 'register-town' },
  { code: 'acnc_town_city+gazetteer', label: 'charity register town, resolved through a gazetteer alias', family: 'register-town' },
  // Their own name names the place.
  { code: 'own_name_town+abs_asgs', label: 'named after its town, resolved through ABS localities', family: 'own-name' },
  { code: 'own_name_town+sal_ratio_dominant', label: 'named after its town; the town is almost wholly in this council', family: 'own-name' },
  { code: 'own_name_town+gazetteer', label: 'named after its town, resolved through a gazetteer alias', family: 'own-name' },
  { code: 'community_name+abs_asgs', label: 'named after its community, resolved through ABS localities', family: 'own-name' },
  { code: 'inferred_from_org_name', label: 'inferred from the organisation’s name', family: 'own-name' },
  { code: 'council_serves_shire', label: 'a council body, placed in the area it serves', family: 'own-name' },
  // Their postcode decides it.
  { code: 'single_lga_postcode', label: 'postcode sits wholly in this council', family: 'postcode' },
  { code: 'straddler_ratio_dominant', label: 'postcode straddles councils; nearly all of it is this one', family: 'postcode' },
  { code: 'poa_ratio_dominant', label: 'postcode at least nine-tenths in this council, corroborated by its localities', family: 'postcode' },
  { code: 'poa_ratio_nolocality', label: 'postcode at least nine-tenths in this council; no locality record to corroborate', family: 'postcode' },
];

const BY_CODE = new Map(PLACEMENT_STAMPS.map(s => [s.code, s]));

/** Plain words for a stamp, including stamps this registry has not met — a
 * new lga_source in the database still renders honestly instead of vanishing.
 * Unknown two-part codes read as "evidence · authority". */
export function stampLabel(code: string): string {
  const known = BY_CODE.get(code);
  if (known) return known.label;
  return code
    .split('+')
    .map(part => part.replace(/_/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
}

export interface StampFamilyRow {
  key: StampFamilyKey | 'unrecognised';
  label: string;
  note: string;
  n: number;
  /** The individual stamps behind the rollup, biggest first. */
  codes: Array<{ code: string; label: string; n: number }>;
}

/** Family rollup for a council's placed organisations, in fixed
 * surest-evidence-first order. Codes the registry does not know are grouped
 * under 'unrecognised' rather than dropped — same register as reasons.ts.
 * Zero, negative and non-numeric counts are dropped; null yields no rows. */
export function stampFamilyRows(
  counts: Record<string, number> | null | undefined
): StampFamilyRow[] {
  if (!counts) return [];
  const entries = Object.entries(counts)
    .map(([code, raw]) => ({ code, n: Number(raw) }))
    .filter(e => Number.isFinite(e.n) && e.n > 0);
  if (entries.length === 0) return [];

  const rows: StampFamilyRow[] = [];
  for (const family of STAMP_FAMILIES) {
    const codes = entries
      .filter(e => BY_CODE.get(e.code)?.family === family.key)
      .map(e => ({ code: e.code, label: stampLabel(e.code), n: e.n }))
      .sort((a, b) => b.n - a.n);
    if (codes.length === 0) continue;
    rows.push({
      key: family.key,
      label: family.label,
      note: family.note,
      n: codes.reduce((sum, c) => sum + c.n, 0),
      codes,
    });
  }

  const unknown = entries
    .filter(e => !BY_CODE.has(e.code))
    .map(e => ({ code: e.code, label: stampLabel(e.code), n: e.n }))
    .sort((a, b) => b.n - a.n);
  if (unknown.length > 0) {
    rows.push({
      key: 'unrecognised',
      label: 'A newer stamp this page does not know yet',
      note: 'The database carries a placement stamp this build has no plain words for; the raw code is shown.',
      n: unknown.reduce((sum, c) => sum + c.n, 0),
      codes: unknown,
    });
  }
  return rows;
}

export function totalPlacedOf(rows: readonly StampFamilyRow[]): number {
  return rows.reduce((sum, r) => sum + r.n, 0);
}

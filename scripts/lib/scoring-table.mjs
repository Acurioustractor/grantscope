// Which table a relevance scorer reads and writes. Default grant_opportunities; pass
// --table=act_private_grant_rounds to score the private SmartyGrants rounds (service role only,
// never public). The private table has no focus_areas column, so it is dropped from select lists.
export const SCORABLE_TABLES = ['grant_opportunities', 'act_private_grant_rounds'];

export function scoringTable(argv = process.argv) {
  const a = argv.find((x) => x.startsWith('--table='));
  const table = a ? a.split('=')[1] : 'grant_opportunities';
  if (!SCORABLE_TABLES.includes(table)) throw new Error(`--table must be one of ${SCORABLE_TABLES.join(', ')}`);
  return table;
}

/** A select list for this table: drops columns the private table does not have. */
export function columnsFor(table, cols) {
  if (table === 'grant_opportunities') return cols;
  return cols.split(',').map((c) => c.trim()).filter((c) => c !== 'focus_areas').join(', ');
}

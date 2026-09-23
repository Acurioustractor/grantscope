// Shared parts for public data pages (profiles first, then reports). Design tokens only, per
// DESIGN.md; the palette ratchet fails any file that brings raw Tailwind colours back.
// Money is formatted by `money` in @/lib/format, the one format for the whole site.
export { Section } from './section';
export { StatRow, Stat } from './stat-row';
export { Panel, FactList, type Fact } from './panel';
export { DataTable, type Column } from './data-table';
export { Callout } from './callout';
export { SourceLine } from './source-line';

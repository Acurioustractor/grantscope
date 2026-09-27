# WA transition source frontier and Jev routing

**Status:** first operational frontier, 27 September 2026.

This work turns the WA ACCO transition research into a monitored evidence system. It does not claim that every public source is already acquired, complete or suitable for publication.

## Live result

- 23 primary-source assets are registered in `source_frontier` under `wa-transition:*`.
- 17 evidence lanes are represented.
- 6 sources are marked for direct structured ingestion.
- 10 require document extraction.
- 3 require dashboard validation.
- 1 requires portal feasibility testing.
- 1 is a catalogue-discovery source.
- 2 are relationship-governed and cannot be treated as ordinary public-data feeds.
- The official WA AER XLSX is already preserved and loaded: 1 artifact, 473 rows, SHA-256 `643cb152cac3c18f31edebb82d69960c89b71e6447f43d170f2083917b3a07b9`.

## Evidence lanes

1. Aboriginal expenditure and budget commitments
2. Tenders WA awards and opportunities
3. Strategic forward procurement and infrastructure pipelines
4. Aboriginal Procurement Policy performance and audit
5. Closing the Gap commitments
6. Kimberley Juvenile Justice Strategy
7. Justice agency performance
8. Independent justice and child-outcome oversight
9. WA open-data catalogue discovery
10. Aboriginal communities and place
11. ORIC and ACNC organisation records
12. ABS population, households, housing and employment
13. Closing the Gap outcome indicators
14. AIHW and Report on Government Services indicators
15. Goods on Country relationship and evidence context

## What is canonical

The human-declared `metadata.data_fit` value is canonical because it records knowledge of the actual acquisition mechanism, not just the landing-page prose:

- `direct-ingestion`
- `document-extraction`
- `dashboard-validation`
- `portal-feasibility`
- `catalogue-discovery`
- `relationship-governed`

Every source also records what it can prove and what it cannot prove. This prevents a policy report from becoming a contract record, a charity register from becoming an ACCO register, population need from becoming demand, or a public relationship page from becoming permission to engage.

## Jev result

Jev was given one bounded choice for each of the 23 public source descriptions. It could choose only an acquisition route. It was explicitly prohibited from deciding ACCO identity, authority, readiness, consent, outcomes or outreach.

- Agreement with the declared data-fit route: 13 of 23
- Disagreements requiring review: 10
- Confidence below 0.80: 11

The result is stored in `data/jev-check/wa-transition-source-routing.json` as review-only evidence.

Jev over-routed sources to document extraction: 17 of 23 received that choice. It misread the AER landing page as document-only even though the linked XLSX has already been ingested, treated the Closing the Gap repository as a dashboard rather than a structured acquisition candidate, and was uncertain about ORIC, ABS, Data WA and the Goods relationship source. This shows that landing-page text alone is not enough to determine acquisition mechanics.

**Decision:** do not let Jev modify the frontier. Use it after acquisition to triage public text into review queues, and measure each classification task against a human-labelled set before any automatic application.

## Acquisition order

1. Keep the AER workbook monitored by hash and ingest new releases as new immutable artifacts.
2. Complete Tenders WA feasibility with award identifiers, pagination, detail fields, variations, omissions and historical depth documented.
3. Capture APP performance reports and OAG findings as aggregate policy evidence, separate from awards.
4. Test supported export paths for SFPP, procurement BI and Closing the Gap dashboards.
5. Profile ORIC, ACNC, ABS, Productivity Commission and AIHW fields already held versus missing WA-specific fields.
6. Extract KJJS, Justice annual reports and oversight recommendations into source-backed records with dates and response status.
7. Use Data WA as a discovery catalogue, then register each useful underlying dataset separately.
8. Keep Goods relationship, community authority and consent evidence behind its existing governance contract. Only publish approved public fields.

## Commands

```bash
node --env-file=.env scripts/wa/fetch-aer-program-list.mjs
node --env-file=.env scripts/wa/ingest-aer-program-list.mjs --dry-run
node --env-file=.env scripts/wa/seed-source-frontier.mjs
node --env-file=.env scripts/wa/seed-source-frontier.mjs --apply
node --env-file=.env scripts/wa/classify-source-frontier-jev.mjs
```

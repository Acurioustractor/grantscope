# NIAA's Indigenous Procurement Story — Evidence-Linked

*Prepared 2026-06-08 · CivicGraph · all figures traceable to source rows (provenance notes at foot)*

## The headline

**The National Indigenous Australians Agency has contracted $72.9M across 364 contracts with 132 verified Indigenous and social enterprises since 2012 — and is actively contracting now** (most recent contract start: July 2026).

108 of those 132 suppliers carry external certification (Supply Nation registration/certification, ORIC registration, or equivalent marks). This is, by supplier count, the fifth-largest evidence-backed Indigenous/social enterprise buying record in the Commonwealth — behind Defence (255 suppliers), Services Australia (174), PM&C (145), and DSS (137).

## The relationships behind the number

| Supplier | Verification | Contracts | Total value |
|---|---|---|---|
| Power Back Pty Ltd | certified | 1 | $10.9M |
| Indigenous Defence & Infrastructure Consortium (IDIC) | certified | 3 | $9.4M |
| Yamagigu Consulting | certified | 20 | $6.3M |
| First People Recruitment Solutions | certified | **50** | $5.8M |
| Habitat Security | certified | 2 | $4.7M |
| Inside Policy | certified | 7 | $3.1M |
| SNAICC — National Voice for Our Children | certified | 4 | $2.4M |
| Ninti One | certified | 6 | $1.9M |

Fifty contracts with one supplier is not a transaction. It is a relationship the IPP was designed to create — and it is invisible in every existing directory.

## Why this matters to NIAA specifically

1. **IPP stewardship.** NIAA administers the Indigenous Procurement Policy. Every agency self-reports targets; nobody can currently see per-supplier delivery evidence across the Commonwealth. CivicGraph holds that join today: 374 commonwealth buyers ranked by their Indigenous/SE contracting record, every figure linked to the underlying AusTender row.
2. **Integrity.** Per-supplier, ABN-keyed delivery history — contract spans, repeat relationships, certification marks aggregated from Supply Nation, ORIC, ACNC and state networks — is the data shape that integrity reviews of IPP participation need. Claims are checkable against what was actually delivered, not against a registration alone.
3. **The supply side is already mapped.** 11,858 social and Indigenous enterprises, 86% ABN-matched, tiered by verification strength (certified / verified / identified), free and open. Certification bodies' marks are presented as signals with attribution — we verify nothing ourselves and gate nothing.

## What we are asking for

Thirty minutes with your procurement or IPP policy team, against one live or upcoming procurement. We will bring the tender-pack tool — supplier evidence, policy citations, weighting support — run on your real category.

---

### Provenance

- Headline + top suppliers: `austender_contracts` joined to `social_enterprises` on supplier ABN, buyer_name = 'National Indigenous Australians Agency'; queried 2026-06-08. 364 contracts / 132 distinct supplier ABNs / $72,9xx,xxx total / contract starts 2012-06-18 → 2026-07-30.
- Cross-agency ranking: `se_buyer_prospects` (rebuilt 2026-06-08 from the same join, 374 buyers).
- Verification tiers: `social_enterprises.verification_tier`, computed 2026-06-08 — certified = external mark (Supply Nation / Social Traders / BuyAbility / B Corp); definitions in CivicGraph docs.
- Registry size/coverage: `social_enterprises` count 2026-06-08 (11,858 rows, 10,236 with ABN).
- AusTender data: published commonwealth contract notices (tenders.gov.au), ingested to `austender_contracts` (770K rows).

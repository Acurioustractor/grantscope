# NIAA Demo Tender-Pack — "First Nations Research, Evaluation & Advisory"

*Prepared 2026-06-09 · CivicGraph · illustrative pack to run live in the 30-minute demo · all figures traceable to source rows (provenance at foot)*

> Purpose: this is the concrete artifact for the demo Ben runs against a live/upcoming NIAA procurement. It pre-fills the category, the policy citation, and a certified-Indigenous supplier shortlist with delivery evidence — so the meeting opens on NIAA's own ground, not a generic pitch. Render the live version at `/procurement/tender-pack` (category + states=Federal) and screen-share it.

## Why this category

NIAA repeat-buys research, evaluation and policy advisory from Indigenous firms — it is the densest, most recurring slice of its $72.9M / 364-contract IPP record (Yamagigu, Ninti One, Inside Policy, SNAICC, 33 Creative all sit here). It is also the category where the IPP's "build a relationship, not a transaction" intent is most visible (Yamagigu: 45 federal buyers; First People Recruitment: 50 NIAA contracts). A buyer planning the next evaluation/advisory panel needs exactly what the tool produces: certified Indigenous suppliers with checkable delivery history.

## Policy citation (auto-inserted by the tender-pack)

**Commonwealth Indigenous Procurement Policy (IPP)** — Commonwealth portfolios carry annual Indigenous procurement targets (3% of new contracts by volume) with mandatory set-aside checks; Supply Nation Indigenous Business Direct is the first port of call.
<https://www.niaa.gov.au/indigenous-affairs/economic-development/indigenous-procurement-policy-ipp>

> Tender-ready text: *"This procurement supports Commonwealth Indigenous Procurement Policy targets. Indigenous-registered suppliers listed are drawn from public registries (Supply Nation, ORIC) with delivery evidence compiled by CivicGraph from AusTender."*

## The supplier shortlist (certified Indigenous · category-matched · delivery-evidenced)

Federal delivery evidence is across **all** Commonwealth buyers (not just NIAA) — it shows the supplier can deliver at scale. ✓ = already a NIAA supplier (bulletproof to name in the room); the rest are certified Indigenous firms with proven federal delivery that NIAA does not yet use — the "defensible new options" the tool exists to surface.

| Supplier | State | Federal delivery | Contracts | Agencies | NIAA incumbent |
|---|---|---|---|---|---|
| Ninti One Limited | ACT | $66.2M | 53 | 14 | ✓ |
| Yamagigu Consulting | ACT | $35.9M | 125 | 45 | ✓ |
| SNAICC — National Voice for Our Children | ACT | $13.1M | 22 | 8 | ✓ |
| Mura Connect | ACT | $12.8M | 32 | 4 | ✓ |
| Waidt Services Australia | ACT | $10.8M | 44 | 6 | ✓ |
| ServeGate Australia | ACT | $129.5M | 251 | 17 | — |
| JNC Group Australia | ACT | $53.2M | 17 | 4 | — |
| Arrpwere Consulting | ACT | $38.3M | 22 | 7 | — |
| Wirrigan Group | ACT | $37.5M | 64 | 8 | — |
| Callida Indigenous Consulting | ACT | $35.8M | 67 | 23 | — |
| The Lowitja Institute | ACT | $21.8M | 11 | 4 | — |
| Curijo | ACT | $20.7M | 77 | 22 | — |

> Demo-day check (Ben): the live tender-pack does proper category matching; this list was assembled from a sector/description keyword filter, so eyeball the non-incumbents for true category fit before naming them (ServeGate and JNC in particular carry mixed-services histories). The five NIAA incumbents are safe to lead with regardless.

## The ask (unchanged from one-pager)

Thirty minutes with NIAA procurement / IPP policy, against one live or upcoming research/evaluation/advisory procurement. We run this tender-pack on the real category, live.

---

### Provenance

- Supplier shortlist: `social_enterprises` (`verification_tier='certified'` AND Indigenous: `icn IS NOT NULL` OR Supply Nation / Indigenous in `source_primary`/`certifications`) filtered to category by `sector`/`description` keyword (research / evaluation / consulting / policy / advisory), LEFT JOIN `austender_contracts` on supplier ABN for delivery evidence. Queried 2026-06-09. Federal delivery = SUM(contract_value) across all buyers; "Agencies" = distinct buyer_name count.
- NIAA-incumbent flag: any row where `buyer_name = 'National Indigenous Australians Agency'`.
- Headline figures (re-verified 2026-06-09, unchanged from 2026-06-08): NIAA = 132 SE suppliers / 108 certified / 124 Indigenous / $72.9M / 364 contracts, starts 2012-06-18 → 2026-07-30.
- Policy text: `apps/web/src/lib/social-procurement.ts` → `SOCIAL_PROCUREMENT_POLICIES.FEDERAL`.

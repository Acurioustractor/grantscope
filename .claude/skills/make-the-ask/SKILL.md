---
name: make-the-ask
description: Walk one funding Ask through the whole three-pipeline ritual — pull CivicGraph evidence, fetch the funder's real requirements, draft in ACT voice, ground every claim, surface the Ben-only questions, park the artefact in Notion, set the GHL next action. Use on /make-the-ask <funder>, "make the X ask", "draft the EOI for X", or when a desk decision-due row gets a pursue. Never submits anything.
---

# Make the Ask

One repeatable ritual per Ask. Balnaves 2026-08-05 is the reference run
(thoughts/shared/drafts/balnaves-eoi-2026-08-05.md). The three-pipeline rule
holds throughout: **GHL owns the Ask's state, CivicGraph owns the evidence,
Notion owns the produced artefact.** You produce a grounded draft and a set of
decisions for Ben. You never submit, send, or push "Submitted".

## The eight steps, in order

### 1. Pull what we already know (CivicGraph)
- Funder row: `node --env-file=.env scripts/gsql.mjs "SELECT name, total_giving_annual, thematic_focus, geographic_focus, giving_philosophy, application_tips, website FROM foundations WHERE name ILIKE '%<funder>%'"`
- Match row (fit, stage, next step): join `org_project_foundations` on `foundations`.
- Org record surface: `/org/act/orgs/<org-slug>` holds relationships, people, money history, GHL door. Loaders in `apps/web/src/lib/services/act-org-record.ts`.
- Check the desk: is it already a GHL Ask or still a decision-due Signal? Not in GHL = not yet an Ask.

### 2. Fetch the funder's actual requirements (their site, today)
WebFetch the application/EOI pages. Extract literally: eligibility (DGR class,
auspice rules), funding range and duration, word limits and fields, submission
method, review timing, exclusions, special conditions (child safety, First
Nations leadership/partnership rules). Never draft against remembered or
DB-cached requirements; the DB row is a lead, the site is the source.

Lessons from the first runs (Balnaves + auDA, 2026-08-05):
- **Get the Guidelines PDF, not just the webpage.** auDA's killer clauses
  (grant size/count, no-proprietary-rights-to-for-profit-partners, mandatory
  CC licence, audited-financials bar) lived ONLY in the PDF.
- **Quantify any revenue-percentage cap against the applicant's real income.**
  ACNC API works when the website times out:
  `curl https://www.acnc.gov.au/api/dynamics/entity/<uuid>` — gives income,
  reporting currency, responsible people, lodgement history. Butterfly's ~$124K
  income turned Balnaves's 15% cap from a footnote into the structural risk.
- **Sweep Gmail before trusting any remembered deadline.** The "QBE Stage 2
  deadline" was a phantom; the mailbox showed ACT was already inside the
  program with a different overdue item entirely.

### 3. Frame the ask against the capital plan
- Grant-side blocks and amounts: `GOODS_CAPITAL_BLOCK_SEED` in `apps/web/src/lib/services/goods-capital-workspace.ts`. Grants route via Butterfly; repayable/equipment route via ACT Pty — never mix them in one ask.
- The ask amount = the blocks that fit the funder's range, named as blocks.
- DGR runs ONLY through The Butterfly Movement Ltd (Item 1 DGR + PBI since 2012). Never ACT Pty, never A Kind Tractor. Verify entity facts against `act-global-infrastructure/wiki/decisions/act-core-facts.md`.

### 4. Draft in voice
- Load `/act-voice` BEFORE writing a word of copy. Institutional-but-warm register for funder docs.
- Reuse the claims library: `act-global-infrastructure/wiki/narrative/goods/` (and sibling project dirs). Only use claims marked as published/deployed; attribute quotes.
- Respect standing house rules found there (e.g. claim-unit-economics-must-be-real: never pitch delivered cost without an actual number — promise the measurement instead).
- Structure: ask table (applicant entity, amount, duration, pillar) → need → what the work is → what this grant funds (blocks) → partnership statement → outcomes/measurement → **Open questions for Ben** → Sources.

### 5. Ground it
Run `/ground` on the draft. HOLD items get fixed inline (soften, attribute, or
flag `[UNVERIFIED — BEN TO CONFIRM]`), never invented around. Structural risks
(revenue-percentage caps, geography mismatches, timing rules) go in Open
questions even when the copy itself is clean.

### 6. Park the artefact (Notion)
Duplicate **"Ask template — Goods funding (duplicate me)"**
(https://app.notion.com/p/3b3ebcf981cf8176b805f86126ab9677, under Goods Sales
Hub), rename to "Ask — [Funder] — [YYYY-MM]", fill it from the draft including
the claims-and-grounding table. It extends the standing **Goods Investment Ask
Template + Workflow** page (https://app.notion.com/p/391ebcf981cf81dfa10eeab7a8ef6950)
— follow that page's status/stage rules and its discipline: Notion first for
deadlines/evidence, GHL first for relationship-stage changes, never let either
become the other. Reference run: "Ask — Balnaves Foundation — 2026-08". The
repo copy under `thoughts/shared/drafts/` is working scratch; Notion is where
production lives once the draft survives grounding.

**Final parking step — link the artefact to its Ask (wayfinder #162).** If the
Ask is already a GHL card, record the Notion page URL against it so the desk
can show "Open draft in Notion ↗":

```bash
node --env-file=.env scripts/set-ask-artefact.mjs <ghl_opportunity_id> <notion_page_url> --name "Ask — [Funder] — [YYYY-MM]"
```

Supabase-side annotation only (`act_ask_artefacts`), never a GHL field. If the
Ask is still a Signal (no GHL card yet), skip this — run it once the card
exists.

### 7. Set the next action (GHL)
The Ask's state lives in GHL. If it's already a card: update next action to
"review + submit EOI" with Ben as owner (Tier 2: one-line confirm first). If
it's still a Signal: the pursue push (grants triage / funder scan buttons)
mints the card — that's Ben's click or an explicit instruction, not yours.

### 8. Hand over and stop
Final message: the ask shape in one table, the ground verdict, the Ben-only
questions ranked by structural risk. Then stop. Submission (portals, emails)
is day-shift, human-in-loop, always.

## Boundaries
- Tier 3 (never without an explicit verb): submitting anything, sending email, moving a GHL stage to Submitted/Won/Lost.
- Tier 2 (confirm first): GHL field writes, Notion edits outside the template duplication.
- No fabricated numbers, names, or endorsements — grounding is the gate, not a formality.

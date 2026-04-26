# Communication & Advocacy Framework — How CivicGraph Generates Power Shift

**Status:** Strategic framework, draft 1, 2026-04-27
**Owner:** Ben Knight
**Purpose:** Connect the data + investigations we've built to the philosophical "why," tie them into the A Curious Tractor portfolio, and design how findings translate into discussions, advocacy, and actual changes in power dynamics.

---

## The fundamental problem this framework solves

We have built an extraordinary atlas: 591K resolved entities, 1.5M cross-system relationships, 76 investigations and reports queryable at sub-second latency, with findings like "33 of 278 federal+state agencies meet the 3% IPP target" and "$678B flows to 4,218 entities receiving both grants and contracts."

**But data is not power.** Reports do not redistribute money. Investigations do not change procurement decisions. The atlas exists; the question is whether anything *moves* because of it.

The accountability cycle breaks at three predictable points:

1. **Echo chamber lock-in** — investigations land where data-curious people already are. The decision-makers who *would* be implicated are the same ones who don't read.
2. **No "now what"** — readers absorb the finding and feel informed, not activated. They have no template, no script, no obvious next move.
3. **Communities affected hear about it last** — the people whose lived experience the data describes are the last to see it. They lack the URL, the time, the framing language that makes it actionable.

This framework is the antidote. It addresses each break point with deliberate design.

---

## The philosophical spine — why this exists at all

Every published artifact must trace back to one sentence:

> *"Track action rather than wait for others."*

That's the A Curious Tractor stance. It's not a tagline — it's a refusal. We refuse the position that:

- Communities should wait for the next Royal Commission
- Indigenous organisations should accept the next IPP "report" five years late
- Small NFPs should hope a Four Corners episode notices them
- Investigative journalists should fight fragmented public registers solo
- Funders should decide based on who they already know

The atlas is the **practical expression** of that refusal. Every cross-system join, every flagged donor-contractor, every LGA proxy score is a sentence in a longer argument: *the systems exist, the data is public, the patterns are knowable, and waiting is no longer required.*

When we communicate, we communicate from inside that frame. Not "look at this dashboard," but "here's the system you operate in, here's how it works against you, here's what you can do about it."

---

## The four-layer portfolio narrative

CivicGraph is one of four ACT projects. Each addresses a different layer of the same problem. **Always tell the story across all four when you have the chance.**

| Layer | Project | What it answers |
|---|---|---|
| **Power** | CivicGraph | Where does the money go? Who's connected to whom? |
| **Evidence** | JusticeHub (ALMA) | What actually works? What's been tested? |
| **Lived experience** | Empathy Ledger | What does this feel like from inside? |
| **Action** | Goods | Where do I shop / partner / vote with my feet? |

A complete CivicGraph investigation is incomplete without the other three layers. **The Indigenous Proxy Problem** isn't just "57% goes to non-Indigenous orgs" (CivicGraph). It's:

- 57% goes to proxy orgs (CivicGraph **power**)
- Programs led by community-controlled orgs have stronger evidence outcomes (JusticeHub **evidence**)
- Here's what it feels like when "your" funding doesn't reach you (Empathy Ledger **lived**)
- Here are the Indigenous-owned suppliers ready to do this work right now (Goods **action**)

That's a complete story. Tell incomplete stories and the audience leaves informed but inert.

---

## Mapping each investigation to its audiences and asks

For every investigation, define **five audiences** and **what each is asked to do**. If you can't fill in all five, the investigation isn't ready to publish.

### Example: IPP Scoreboard (`/reports/ipp-scoreboard`)

| Audience | What they're shown | What they're asked to do |
|---|---|---|
| **Indigenous business owners** | "Your region's agencies + their IPP performance" | Email procurement officers; cite specific numbers; reach out for partnership |
| **Federal/state procurement officers** | "Your agency, vs peers" | Internal reform; engage Supply Nation; review their own contracting |
| **Journalists** | "33 of 278 — name them, find the worst, file FOI" | Story pitches with specific agencies + dollar figures + supplier alternatives |
| **MPs and political staffers** | "Your portfolio agency, your local impact" | Question Time prep; estimates committee; ministerial briefs |
| **General public / Indigenous community members** | "Where's your tax money going? Where's it not?" | Sign petition; share story; vote with their procurement (Goods integration) |

This is the **action menu**. The report page itself should embed at least one path forward for each audience — not bury it in methodology.

### Apply to every investigation

Run this 5-row table for:
- The Consulting Class
- Donor-Contractors
- Double-Dippers
- Indigenous Proxy Problem
- IPP Scoreboard
- LGA Proxy Score
- Board Interlocks
- Funding Deserts
- (each new one as it ships)

If any cell is empty, you have homework before publication.

---

## The communication artifact stack

Every investigation needs to ship as **multiple forms simultaneously**, not just a web page. Build these as templates so subsequent investigations slot in cheaply.

### 1. The web report (we have this)
Long-form, methodology, charts, Live data. Lives at `/reports/{slug}`.

### 2. The 30-second social card
One headline finding, one big number, one image. Posted to LinkedIn, Twitter/X, Mastodon, Bluesky, all at once. Asset stored at `output/social/{slug}.png`.

**Template structure:**
- Top: dataset claim ("33 of 278 federal agencies hit 3% IPP target")
- Middle: data viz (bar chart, ranked list, choropleth)
- Bottom: link + "@curioustractor"

### 3. The 600-word op-ed/long thread
Newspaper op-ed shape. Or a 12-tweet thread. Same structure: **hook → finding → why it matters → who pays the price → what's next**. Lives at `thoughts/shared/op-eds/{slug}.md`.

### 4. The MP/policymaker brief (one page, PDF)
For decision-makers who never read web pages. Format: Issue. Numbers. Implication for their portfolio. Recommended action. Sources. Lives at `output/briefs/{slug}-brief.pdf` (auto-generated from data).

### 5. The community action template
For affected communities. Structure: Here's your region. Here's what the data shows. Here's an email template you can copy. Here's an FOI request you can file. Here are local Indigenous-owned alternatives. Lives at `/reports/{slug}/community-action`.

### 6. The journalism packet
For investigative reporters. Raw data + methodology + flagged outliers + suggested angles. Already drafted in our outreach (`thoughts/shared/outreach/`). Send proactively to specific journalists when an investigation drops.

### 7. The Empathy Ledger story prompt
For Empathy Ledger to commission a first-person story matching the data finding. "We have data showing X. Find someone whose lived experience expresses X. Publish their story. Anchor it back to the entity page on CivicGraph."

### 8. The Goods routing layer
For investigations involving suppliers/businesses. After reading "QLD Health $1.01B at 0% Indigenous spend," the reader should land on Goods showing 200+ Indigenous-owned QLD-based suppliers ready to bid.

---

## The campaign cycle (how findings actually propagate)

A finding doesn't "publish" once. It cycles through stages, each with a different audience and form. The cycle takes 4-8 weeks per investigation.

```
Week 0: Drop
  → Web report goes live
  → Social cards posted
  → Email to subscribers
  → Direct journalism outreach (3-5 named reporters)

Week 1-2: Amplify
  → Op-ed pitched to The Guardian / Saturday Paper / Crikey / Michael West
  → MP brief sent to relevant portfolio shadow ministers + crossbench
  → Indigenous advisory invited to comment publicly
  → Empathy Ledger commissions matching first-person story

Week 2-4: Network
  → Peak bodies cite (ACOSS, Philanthropy Australia, NIAA, NCOSS)
  → Academic/think tank engagement (Grattan, Australia Institute, ANU)
  → Conference / podcast appearances
  → Goods integration ships if applicable

Week 4-8: Convert
  → Did an agency respond? An MP ask a question? A program shift?
  → Document the response or non-response
  → "What changed (or didn't)" follow-up post
  → Set up watcher for next data refresh

Week 8+: Compound
  → Next investigation drops, references this one
  → Pattern accumulates: "we predicted this, here's the next data point"
  → Brand "we say it before institutions do" emerges
```

---

## Working against the power dynamics — concrete operating principles

**Principle 1: Always name names.** Generic findings deflect ("various agencies underperform"). Named findings provoke ("QLD Health awarded $1.01B with 0% Indigenous spend"). Names create accountability.

**Principle 2: Rotate the spotlight.** Don't only investigate the obvious enemies (consulting class, big philanthropy). Investigate the comfortable too — including organisations we work with. The partner principle on `/about/curious-tractor` is the spine: partners don't get vetoes.

**Principle 3: Centre the affected, not the institution.** Every story should pass the "would this make sense to the person at the bottom of the system?" test. Indigenous Proxy isn't about funders; it's about Indigenous orgs cut out of money meant for them. Tell it from their position.

**Principle 4: Build the alternative as you critique.** Goods is the antidote to procurement failure. JusticeHub evidence is the antidote to "we tried something and it didn't work." Don't only critique — point at the alternative that exists.

**Principle 5: Make accountability cheap.** A reader should be able to act in under 60 seconds. Pre-fill the FOI form. Pre-write the MP letter. Pre-curate the supplier list. Friction is the enemy.

**Principle 6: Refuse comfort.** When findings would embarrass a partner, embarrass the partner. When findings would embarrass us, name our own limitations. Trust accumulates from showing the unflattering data, not the flattering kind.

**Principle 7: Track what shifted.** Most investigations land and disappear. We measure differently: did an agency respond? Did funding patterns change in the next quarter's data? Did anyone in power even acknowledge it? Those are the metrics, not page views.

---

## The communication map across the portfolio

When publishing, route to ALL channels, not just the loudest one.

```
                       INVESTIGATION
                     (CivicGraph data)
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   STORY layer        EVIDENCE layer       ACTION layer
   (Empathy Ledger)   (JusticeHub)         (Goods)
        │                   │                   │
        │ "Sarah's Story"   │ "Programs led    │ "200+ Indigenous
        │ tied to entity X  │ by community-    │ suppliers in QLD
        │                   │ controlled orgs   │ ready right now"
        │                   │ outperform by Z%" │
        ▼                   ▼                   ▼
                   PUBLIC AUDIENCE
                  (where we tell people)
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   MEDIA               COMMUNITIES         INSTITUTIONS
   (Guardian,          (Indigenous orgs,   (MPs, agencies,
   Crikey,             affected LGAs,      foundations,
   Michael West)       small charities)    universities)
        │                   │                   │
        ▼                   ▼                   ▼
   COVERAGE            ORGANISING          POLICY CHANGE
                                          / CONTRACTS / FUNDING
                                              │
                                              ▼
                              MEASURED OUTCOMES (next data refresh)
                                              │
                                              ▼
                                    NEXT INVESTIGATION
```

The cycle is the strategy. Each investigation feeds the next.

---

## What this looks like operationally for the next month

**Week 1 (now):**
- Finalise IPP Scoreboard report styling + populate community action template
- Send IPP findings to: Michael West, Nick Evershed (Guardian), Crikey Inq, Saturday Paper data team
- Draft and queue 30-second social cards for IPP + Double-Dippers + LGA Proxy
- Indigenous advisory: send formalisation requests (already drafted in `thoughts/shared/outreach/`)

**Week 2:**
- Empathy Ledger commissions first-person story tied to one named org from the Indigenous Proxy LGA scoreboard
- MP brief on IPP performance sent to Senator Dorinda Cox, Senator Lidia Thorpe, shadow procurement minister, relevant crossbench
- LinkedIn long-form post on Double-Dippers: "$678B across 4,218 organisations getting both grants and contracts"

**Week 3:**
- Track responses; document non-responses
- Set up Goods integration showing Indigenous-owned QLD suppliers as response to IPP scoreboard
- Pitch op-ed: "Australia's IPP target was set in 2015. A decade on, we miss it by two-thirds."

**Week 4:**
- Compound post: "What changed (or didn't) since the IPP scoreboard dropped"
- Next investigation prep: Board Interlocks v2 with the new data

**Months 2-3:**
- One new investigation per month, all using the same artifact stack
- Track citations, agency responses, MP questions, funding changes

---

## Open questions / what's still hard

1. **Resourcing the artifact stack.** Each investigation needs 8 forms (web + social + op-ed + MP brief + community template + journalism packet + EL story + Goods routing). That's a lot of work per drop. Can we build templates once and reuse?

2. **Indigenous data governance.** Until the advisory is seated, every Indigenous-related finding goes out under the "Under Advisory Review" banner. Speeds the data, slows the publication.

3. **Audience acquisition.** No matter how good the artifact, if no one reads it, no power shifts. The journalism partnership pipeline (drafted but unsent) is the most-leveraged unblock here.

4. **Measuring shift.** "Did this change anything?" is the hardest question and the most important. Need a tracking framework: agency response logs, MP questions, funding pattern shifts in next data refresh.

5. **Sustainability.** This is intense. A 4-week cycle per investigation × 12 investigations/year = full-time work. The portfolio model (CivicGraph + JusticeHub + Empathy Ledger + Goods) lets us share that load — but only if all four are operational.

---

## The one-line frame to use everywhere

When asked "what is CivicGraph?" — don't say "an accountability atlas" or "civic data infrastructure" or anything that sounds like a product. Say:

> *"Civic infrastructure for communities to see and act on the systems they're inside. We track action rather than wait for others."*

Then tell a specific story. Don't pitch the platform; pitch the IPP scoreboard, or the Indigenous Proxy LGA finding, or the Double-Dippers. The platform is invisible. The story is what travels.

---

*This framework will evolve. First-draft commit; revise based on what actually moves. The compounding only matters if it converts to outcomes.*

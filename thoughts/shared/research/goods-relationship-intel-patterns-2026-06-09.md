# Relationship-Intelligence / People-Graph UI Patterns to Steal for the Goods Command Center

**Date:** 2026-06-09
**For:** Goods on Country command center (`/org/act/goods/*`) inside CivicGraph
**Question:** How do best-in-class relationship-intelligence / people-CRM / network-graph products build their UI/UX, and which patterns map onto the data we already hold (GHL tags + email/conversations, the Supabase `goods_relationships` registry, the board-interlock graph `mv_board_interlocks` / `mv_person_entity_network`, the Xero money ledger, decoded "funder insight" tags, and a future LinkedIn signal)?

**Method:** Web research, June 2026. Every pattern below is tagged with the tool, a source URL, and "how it maps to our stack." Anything I could not verify from a primary or near-primary source is marked **(unverified)** and not used as a basis for a recommendation.

**What we already hold (the inventory the patterns are scored against):**
- `goods_relationships` registry + `goods_compute_warmth()` warmth function (Phase 1 shipped) — already a per-relationship warmth signal.
- GHL CRM sync: contacts, **conversations/email history** (MCP `conversations_get-messages`), **tags** (incl. decoded "funder insight" tags), **opportunities/pipelines** (MCP `opportunities_get-pipelines`).
- Board-interlock graph: `mv_board_interlocks` (person → multiple entities), `mv_person_entity_network` (person→entity w/ financial footprint), `mv_person_influence` (per-person influence score).
- Xero money ledger (received + in-play + available), decoded funder insight.
- The big civic graph: `gs_entities` (159K), `gs_relationships` (1.08M), `foundations`, `political_donations`, `austender_contracts` — i.e. we can resolve a contact to an entity and pull its public funding/donation/contract footprint.
- LinkedIn: **not yet ingested** (treat as a roadmap source, not a held asset).

---

## Section 1 — Relationship-Intelligence CRMs

### 1.1 Affinity — relationship strength score + warm-intro path with a numeric score
**Signature pattern.** Affinity auto-captures email + calendar interactions across the *whole team's* inboxes and assigns every relationship a proprietary **relationship strength score** based on *"recency and frequency of interactions."* It then surfaces the **warmest path to an introduction** — e.g. a profile shows *"Recommended introduction to Martin Smith with relationship score of 88/100"* — and lets you set a **trigger/alert when a key contact's score drops below a threshold** so important relationships don't decay silently.
**Why it works.** It converts invisible inbox/calendar exhaust into a single legible number, then turns that number into one action ("ask Person X to introduce you, they're the 88/100"). The decay-alert reframes the CRM from a static directory into a maintenance system. Affinity claims warm intros close deals ~25% faster and the automation saves ~200 hrs/yr/dealmaker.
**Source.** https://www.affinity.co/product/relationship-intelligence · https://www.affinity.co/blog/relationship-intelligence · https://www.affinity.co/why-affinity/what-is-relationship-intelligence
**How it maps to our stack.** We already have `goods_compute_warmth()` — surface it everywhere as an **0–100 score with a recency+frequency basis derived from GHL conversation timestamps**, not just a static tier. Add a **decay trigger**: a scheduled job (we already run a 12h GHL warmth sync) flags any "key" Goods relationship whose last-touch recency has crossed a threshold → "at-risk relationship" card. The warm-intro recommendation maps directly onto the board-interlock graph: for a target person/entity, rank *our* people by their edge weight to that target and recommend the strongest opener (the "warm-intro engine" commit `0471cc2` already exists — this is the UI for it).

### 1.2 Folk — "Strongest Connection" field computed across the whole team
**Signature pattern.** Folk computes, for every contact, **who on your team is closest to them** based on all team members' interactions, and exposes it as a **"Strongest Connection" field that appears inline in table view, kanban view, AND the contact profile** — shown by default on every new table view. It answers "does anyone here already know this person, and who should ask for the intro?" without you opening a separate tool.
**Why it works.** The insight is *embedded in the row you're already looking at* rather than buried in a separate "network" screen. Making it a first-class column means it sorts, filters, and groups like any other field — you can sort a prospect list by "who can open this door."
**Source.** https://www.folk.app/ · https://www.folk.app/articles/best-crm-for-networking · https://www.linkedin.com/posts/folkhq_whos-your-strongest-connection-folks-activity-6971017337395150849-Lx-k
**How it maps to our stack.** This is the single most directly portable pattern. Add a computed **"Best opener"** column to the Goods target/foundation list: for each target, `JOIN` through `mv_board_interlocks` / `goods_relationships` to find the Goods-side person with the strongest edge, render their name + warmth score inline. It makes the warm-intro engine *ambient* instead of a destination page.

### 1.3 Attio — malleable object model + automatic bidirectional relationship intelligence + per-record activity timeline
**Signature pattern.** Attio is built on (a) a **malleable data model** (objects = People, Companies, custom objects; records = rows; lists = saved subsets you can annotate without mutating the record) and (b) **automatic bidirectional relationships** — link a Person to three Companies and you see all three from the Person record *and* the Person from each Company record, surfaced automatically. Every record has an **Activity timeline**: first correspondence, list adds/changes, notes, and past/upcoming meetings pulled from connected calendars. Lists render as **table OR kanban** with the same data.
**Why it works.** Bidirectional auto-surfacing means a person→entity edge entered once shows up on both ends — no double entry, no stale half. The table↔kanban toggle on the *same* list lets one dataset be both a spreadsheet (bulk triage) and a pipeline board (stage flow).
**Source.** https://attio.com/help/reference/attio-101/attios-data-model · https://attio.com/help/reference/attio-101/attios-data-model/understanding-records · https://novlini.io/blog/how-to-model-complex-data-in-attio-with-custom-objects-and-relationships
**How it maps to our stack.** Our Supabase graph is *already* bidirectional (`gs_relationships`, `mv_person_entity_network`) — the lesson is **render it bidirectionally in the UI**: on a person page show their entities; on an entity page show its people, from the same edge table. For the Goods target list, ship the **table↔kanban toggle on one query** so "foundation target list" (commit `27692dc`) and a pipeline board are two views of one dataset, not two builds.

### 1.4 Clay / Mesh — interaction-timeline profile card + "Automatic Reconnect" serendipity prompt
**Signature pattern.** Clay (now "Mesh") auto-aggregates contacts from **email, calendar, LinkedIn, Twitter, iMessage**, keeps them fresh in the background, and gives every person a **profile card with interaction timeline, connected platforms, notes, tags**. Its standout is the **"Review" dashboard** that *curates reconnection prompts based on your activity*, plus **"Automatic Reconnect,"** which randomly surfaces a few people to inject "happy serendipity." It also surfaces **life-event triggers** ("when someone changes jobs, moves cities, or is mentioned in the news").
**Why it works.** It flips the CRM from pull (you remember to look) to push (it tells you who to talk to today). Job-change/news triggers give a *reason* and a *timing* for outreach, which is the hardest part of relationship maintenance.
**Source.** https://clay.earth/ · https://techcrunch.com/2023/05/16/clay-introduces-an-ai-helper... · https://muncly.com/clay-earth-review-is-this-an-end-game-personal-crm/
**How it maps to our stack.** Build a Goods **"Today" reconnection feed**: rank Goods relationships by `(importance × staleness)` from GHL last-touch and warmth, surface 3–5/day. The "life-event trigger" maps to our civic graph: when a contact's entity appears in a **new grant, new contract, new donation, or new ACNC filing**, fire a "reason to reach out" card — we own the data feeds that produce these events, which Clay can only scrape.

### 1.5 Salesforce Einstein Relationship Insights (ERI) — "show me the passage that proves they know each other"
**Signature pattern.** ERI is an agent that scans web, social, email, and collaboration apps to discover relationships between people/companies, then **highlights the connected entities inside the source document and shows you the exact passage of unstructured text that explains how two people know each other** (e.g. a news article mentioning them together). It recommends related people/companies and warm-intro routes inline.
**Why it works.** **Evidence-on-hover.** A relationship claim is far more trustworthy when you can see the sentence it came from. This is the antidote to "black-box score I don't believe."
**Source.** https://help.salesforce.com/s/articleView?id=ind.intro_eri.htm · https://www.salesforce.com/news/stories/salesforces-new-ai-agent-identifies-business-connections... · https://trailhead.salesforce.com/content/learn/modules/einstein-relationship-insights-basics
**How it maps to our stack.** Every Goods relationship edge should be **clickable to its provenance**: which GHL tag, which email thread (link to the GHL conversation), which board-interlock row, which donation/contract record produced the edge. We hold structured provenance (table + row) that ERI has to infer from prose — make "why do we think this?" a one-click reveal. (Aligns with the repo's `.provenance.md` discipline.)

### 1.6 Dex — keep-in-touch cadence + nudges as the core loop
**Signature pattern.** Dex's whole product is **keep-in-touch reminders**: set a cadence per contact, get a **nudge when it's time to reach out**, sort contacts by importance, and never let a relationship "fall through the cracks." It centralizes email, calendar, LinkedIn, and messaging into one timeline and offers pre-meeting briefs.
**Why it works.** It makes *cadence* the unit of the CRM, not the contact. The job-to-be-done ("stay in touch with the right people often enough") is the literal home screen.
**Source.** https://getdex.com/product/ · https://getdex.com/blog/personal-crm-for-networking/
**How it maps to our stack.** Add a **cadence field** to important Goods relationships (advisory members, key funders) and let the existing scheduled warmth job emit nudges. **Pre-meeting brief** is a strong fit: before a meeting with a contact, auto-assemble GHL history + Xero money state + civic-graph footprint into one card.

### 1.7 HubSpot / Clari pattern — relationship/deal health + at-risk signals from activity decay
**Signature pattern (cross-tool, verified at category level).** Modern pipeline tools attach a **health score** to each deal/relationship from engagement signals, and **flag at-risk** ones via metrics like *Days in Current Stage*, *Total Pushes*, and *Deal Activity Score*; AI surfaces **next-best-action** ("which accounts to call today, which deals need attention"). Pipedrive is repeatedly cited for **activity-based selling reminders** on a visual board.
**Why it works.** Risk is defined by *absence of recent activity*, which is computable from data you already have, and it's shown as a colour/flag on the board you already look at.
**Source.** https://www.salesforce.com/sales/b2b-sales-tools/ · https://pipeline.zoominfo.com/sales/best-sales-pipeline-management-software-tools · https://www.hyperbound.ai/blog/sales-pipeline-visibility-tools
**How it maps to our stack.** "Days in current stage" and "activity decay" are trivially computable from GHL opportunity stage timestamps + last-conversation date. Render at-risk as a red Bauhaus flag on the pipeline card.

---

## Section 2 — Connection / Network Visualization (making a people-graph legible, not a hairball)

### 2.1 Obsidian graph view — local/ego graph with depth slider + colour groups by query
**Signature pattern.** Two graphs: a **global graph** and a **local (ego) graph** showing only what links directly to the current note, with a **depth slider** (depth 1 = direct neighbours, depth 2 = neighbours-of-neighbours…). **Colour groups** are defined by *search queries* (e.g. nodes matching `tag:#funder` go red), so the same graph re-colours by whatever dimension you ask. **Hover highlights a node + its connections** and dims the rest; click opens the node.
**Why it works.** The depth-limited ego graph is the single best anti-hairball move: you never render the whole 159K-node graph, you render *this person and 1–2 hops*. Query-driven colour groups let one canvas answer many questions ("colour by sector," "colour by warmth tier") without rebuilding.
**Source.** https://obsidian.md/help/plugins/graph · https://help.obsidian.md/Plugins/Graph+view · https://mindmappingsoftwareblog.com/obsidian-graph-view/
**How it maps to our stack.** Our `/graph` page already does force-directed; add a **per-person ego mode with a 1–2 hop depth control** sourced from `mv_person_entity_network` + `goods_relationships`, and **colour-group by GHL tag / warmth tier / sector**. Hover-to-highlight-neighbours is a small react-force-graph change with big legibility payoff.

### 2.2 LinkedIn — "How you're connected" panel + degree badges + mutual connections
**Signature pattern.** Every profile shows a **degree badge (1st / 2nd / 3rd)** and a **"How you're connected" panel** listing **mutual connections by name, shared companies/schools, and shared groups**. "2nd" literally means "you share ≥1 mutual connection," and the mutuals are the suggested intro path.
**Why it works.** Degree is an instantly-readable proxy for reachability; the mutual-connections list *names the specific humans* who can bridge you. It's "you ↔ them via X" reduced to a glanceable badge + a short list.
**Source.** https://www.linkedin.com/help/linkedin/answer/a545948/view-your-connection-s-connections · https://leaddelta.com/how-to-view-connections-on-linkedin/
**How it maps to our stack.** Compute a **degree badge for any target relative to Goods** ("2nd — connected via Nick → [Foundation board member]") from the board-interlock + relationship graph. Render a **"How Goods is connected" panel** on every funder/target page: shared boards (`mv_board_interlocks`), shared funders, mutual contacts. This is LinkedIn's killer feature rebuilt on data we *own* (so no scraping, no privacy walls).

### 2.3 Kumu — interactive systems maps with controls (filter / focus / cluster) + click-for-narrative
**Signature pattern.** Kumu turns a backing spreadsheet into a relationship map and lets authors add **on-map Controls (buttons, dropdowns, toggles)** that **filter, focus, or cluster** the live view. **Clustering** promotes a profile attribute into explicit grouping (nodes drift into natural clusters); published maps are fully interactive (zoom, click an element/loop for its **narrative**, video, links).
**Why it works.** It hands *exploration* to the viewer via a small set of controls instead of pre-baking one static layout. Click-for-narrative means each node/edge can carry a story, not just an ID — exactly the warmth/context Goods wants to show.
**Source.** https://kumu.io/ · https://docs.kumu.io/guides/controls · https://docs.kumu.io/guides/sna-network-mapping.html
**How it maps to our stack.** Give the Goods graph a **control strip**: dropdown to filter by sector/state, toggle to cluster by warmth tier or funder-theme, focus-on-selection. **Click-for-narrative** maps to a side drawer that pulls the relationship's GHL notes + money history + provenance — turning a node click into the full Goods context card.

### 2.4 Polinode — centrality metrics drive node size/colour + saved views + shortest-path
**Signature pattern.** Fully customizable node size/color/shape, **30+ network metrics** (betweenness centrality, PageRank, community detection), **save up to 50 named views** (filters + visual settings bundled), **layers/views to explore sub-networks**, and **shortest-path finding** between two nodes. Survey mode collects relationship data via prompts like *"Who do you go to for advice?"*
**Why it works.** Encoding centrality as size/colour means the *important* nodes are visually loud — the eye finds the brokers without reading. Saved views turn analysis into reusable dashboards. Shortest-path is the literal "warm-intro route" between two people.
**Source.** https://www.polinode.com/info/network-visualization · https://www.polinode.com/product/network-visualization-tool · https://blog.polinode.com/using-polinode-for-social-network-analysis
**How it maps to our stack.** We already compute power/influence (`mv_person_influence`, `mv_entity_power_index`) — **size graph nodes by influence/power score and colour by warmth**. Ship **named saved views** ("youth-justice funders," "warm + high-influence") for the Goods graph. **Shortest-path** between Goods and any target is the visual form of the warm-intro engine — render the actual path nodes ("you → Nick → board member → funder").

---

## Section 3 — Pipeline & Insight UX

### 3.1 Kanban pipeline board on the same dataset as the table (Attio / Folk)
**Pattern.** One list, two renderers — **table for bulk triage, kanban for stage flow** — columns = pipeline stages, cards draggable between them.
**Why it works.** No fork between "the data" and "the pipeline"; moving a card *is* the data edit.
**Source.** https://attio.com/help/reference/attio-101/attios-data-model/understanding-lists · https://www.folk.app/
**How it maps to our stack.** Build the Goods money/relationship pipeline as a kanban over GHL opportunities (`opportunities_get-pipelines`) *and* let it toggle to the existing target-list table. Stages: e.g. Identified → Warm intro → In conversation → Proposal → Committed (mirror the Money page's received/in-play/available split).

### 3.2 Next-best-action / "who to call today" surface (Einstein, Pipedrive, Clari)
**Pattern.** A daily action surface that names **specific accounts to act on today**, flags **deals needing attention**, and shows **activity-based reminders** on the board.
**Why it works.** Removes "where do I start?" — the system triages the queue.
**Source.** https://www.salesforce.com/sales/b2b-sales-tools/ · https://pipeline.zoominfo.com/sales/best-sales-pipeline-management-software-tools
**How it maps to our stack.** A Goods **"Today" panel**: top 5 actions ranked by `(money-at-stake × stage-urgency × relationship-staleness)`. Inputs we already hold: Xero in-play amounts, GHL stage age, warmth recency.

### 3.3 At-risk / health flag from activity decay (HubSpot/Clari category)
**Pattern.** Per-deal/relationship **health score**; **at-risk flag** from *Days in Current Stage*, *pushes*, *activity score*.
**Why it works.** Risk = measurable absence of recent activity, shown as colour on the card you already watch.
**Source.** https://www.hyperbound.ai/blog/sales-pipeline-visibility-tools
**How it maps to our stack.** Compute "days in stage" from GHL stage timestamps; flag stalled opportunities and decaying key relationships with a Bauhaus-red corner flag.

### 3.4 Unified activity timeline fusing multiple sources (Attio / Dynamics / folk)
**Pattern.** A **single scrollable feed per record** merging system events + human touches: first correspondence, emails, calls, calendar meetings, list/stage moves, notes — with type icons; teams can comment/tag inline.
**Why it works.** One chronology = "the whole story of this relationship" in one place; no tab-switching to reconstruct context.
**Source.** https://attio.com/help/reference/attio-101/attios-data-model (Activity timeline) · https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/timeline · https://www.folk.app/articles/best-ai-personal-crm
**How it maps to our stack.** Build a **fused Goods relationship timeline**: GHL conversations/emails (`conversations_get-messages`) + Xero invoices/payments for that entity + civic-graph events (new grant/contract/donation) + manual notes, one feed, source-icon per row, each row links to its provenance.

---

## Section 4 — Membership / Community / Advisory UX

### 4.1 Boardable — People Directory with roles + self-service profiles + committee groups
**Pattern.** A **People Directory** holding contact details, **roles/responsibilities**, and rich profiles (background, expertise, professional affiliations) that **members update themselves**; searchable/filterable by name/role/committee. **Groups** structure work into committees, sub-committees, **advisory members**, and staff, with **distinct access levels** (member, committee, exec, admin, guest).
**Why it works.** A roster that members maintain stays fresh; expertise/affiliation fields make the board *searchable as a capability map* ("who here knows youth justice?"). Groups model the real governance structure.
**Source.** https://boardable.com/resources/top-5-boardable-features-for-nonprofit-board-management-software/ · https://boardable.com/
**How it maps to our stack.** Build a Goods **Advisory & Members roster**: per-member profile (role, expertise tags, entity affiliations pulled from the graph), **filter by capability**, group into Advisory vs Charity Members vs Staff with role-based visibility. The "expertise" field doubles as a **warm-intro asset** ("which advisor opens which door").

### 4.2 OnBoard — board lifecycle & succession (terms, continuity)
**Pattern.** Proactive management of **member terms and succession** across the **governance lifecycle** for leadership continuity.
**Why it works.** Membership isn't a static list — it has tenure, term limits, and a pipeline of incoming members. Modelling lifecycle prevents gaps.
**Source.** https://www.onboardmeetings.com/board-life-cycle-management/ · https://www.onboardmeetings.com/
**How it maps to our stack.** Add **term/tenure fields** and a **"becoming a member" pipeline** (prospect → invited → onboarding → active → alumni) to the Goods advisory layer — a kanban (per §3.1) for governance, not just deals. Directly relevant given the Butterfly stewardship handover (26 Jun 2026) and Indigenous-led board install.

### 4.3 Orbit Model / community funnel — concentric engagement levels + the membership ladder
**Pattern.** A **circular, compounding funnel** (Audience → Subscriber → Participant → Member → Advocate) and the **Orbit Model's concentric levels** (Explorers → Participants → Contributors → Advocates) — members move *inward/up* as engagement deepens; a **"ladder of engagement"** gives multiple entry points so lurkers can step up at their own pace.
**Why it works.** It visualizes belonging as **distance-from-core** rather than a flat list — instantly shows who's central vs peripheral and where to invest to pull someone closer. Commsor/Orbit attach an **engagement/gravity score** and surface "most engaged contributors."
**Source.** https://github.com/orbit-love/orbit-model · https://orbit-model.vercel.app/ · https://fastercapital.com/content/Community-funnel-Building-a-Strong-Community-Funnel... · https://www.commsor.com/post/community-building
**How it maps to our stack.** Render the Goods community as **concentric orbits** (core advisory → active members → engaged contacts → wider network), placing each contact by an **engagement score derived from GHL activity + warmth + money relationship**. This is a beautiful, screenshot-worthy way to SHOWCASE the network and doubles as the "how people become members" funnel: outer orbit = prospects, inner = members.

### 4.4 Commsor "Member Audit" nudge — auto-surface a member to check in on
**Pattern.** Automatically **picks a (semi-)random member and reminds you to check in** on them, at a chosen cadence (daily/weekly/monthly).
**Why it works.** Same serendipity engine as Clay's Reconnect, applied to membership care — guarantees no member goes untended.
**Source.** https://support.commsor.com/article/36-member-audit
**How it maps to our stack.** Re-use the §1.4 reconnection feed for the advisory/member roster — weekly "check in on this member" nudge.

---

## Top 10 Patterns to Steal for Goods (ranked by leverage on data we already hold)

Ranking = (value of the insight) × (how much of the data we already own) ÷ (build cost). Patterns needing LinkedIn ingestion are de-ranked since we don't hold it yet.

1. **"Best opener" as an inline column (Folk Strongest Connection).** On every target/foundation row, compute the Goods-side person with the strongest edge to that target (via `mv_board_interlocks` + `goods_relationships`) and show name + warmth inline. Makes the existing warm-intro engine *ambient*. **Data: 100% held.** → §1.2
2. **"How Goods is connected" panel + degree badge (LinkedIn).** On every funder/target page: degree ("2nd — via Nick → board member"), shared boards, shared funders, mutual contacts. LinkedIn's killer feature, rebuilt on data we own. **Data: 100% held (board-interlock graph).** → §2.2
3. **Warm-intro shortest-path, drawn (Polinode + Affinity score).** Render the actual path nodes from Goods → target with edge weights, and a single recommended opener with an 0–100 warmth score. **Data: held; `goods_compute_warmth` exists.** → §2.4 / §1.1
4. **Fused relationship timeline (Attio/Dynamics/folk).** One feed per relationship: GHL emails/conversations + Xero invoices/payments + civic-graph events + notes, with source icons and one-click provenance. **Data: 100% held across GHL + Xero + Supabase.** → §3.4
5. **Ego graph with depth slider + query-driven colour groups (Obsidian).** Per-person 1–2 hop view, colour by GHL tag / warmth / sector, hover-highlights neighbours. The anti-hairball move on our existing `/graph`. **Data: held.** → §2.1
6. **Relationship decay trigger + "Today" reconnection feed (Affinity + Clay + Dex).** Scheduled job (we already run 12h warmth sync) flags key relationships whose recency crossed a threshold; daily 3–5 "who to reach out to" feed ranked by importance × staleness. **Data: held (GHL last-touch + warmth).** → §1.1/§1.4/§1.6
7. **Life-event "reason to reach out" cards (Clay) — our version is better.** When a contact's entity hits a *new grant / contract / donation / ACNC filing*, fire an outreach card. Clay scrapes these; we own the feeds (`grant_opportunities`, `austender_contracts`, `political_donations`, `acnc_charities`). **Data: 100% held — a genuine moat.** → §1.4
8. **Concentric-orbit membership view (Orbit Model).** Show the Goods community as orbits (core advisory → members → engaged → network), placing each contact by an engagement score (GHL activity + warmth + money). Doubles as the "how people become members" funnel and is the most showcase-worthy visual. **Data: held.** → §4.3
9. **One dataset, table↔kanban toggle + at-risk flags (Attio/Folk/Clari).** Goods pipeline as a kanban over GHL opportunities that toggles to the target-list table; red flag on cards stalled by "days in stage" / activity decay. **Data: held (GHL stage timestamps + Xero in-play).** → §3.1/§3.3
10. **Advisory/Member roster with expertise tags + lifecycle pipeline + provenance-on-click (Boardable/OnBoard + Einstein ERI).** Capability-searchable member directory, a "becoming a member" pipeline (prospect → onboarding → active → alumni) with term/tenure, and every relationship edge clickable to its source (which tag/email/board row). Timely for the Butterfly handover + Indigenous-led board install. **Data: held.** → §4.1/§4.2/§1.5

**De-ranked (needs data we don't yet hold):** full LinkedIn ingestion (Clay/Dex/Attio enrichment) — valuable but blocked on ingestion + ToS; treat as a roadmap source. Auto-extracting "they know each other" from unstructured prose (Einstein ERI's NLP) — we don't need it because our edges are already structured; we just need to *show the provenance* we already have (pattern #10).

---

### Source list
Affinity: https://www.affinity.co/product/relationship-intelligence · https://www.affinity.co/blog/relationship-intelligence · https://www.affinity.co/why-affinity/what-is-relationship-intelligence
Folk: https://www.folk.app/ · https://www.folk.app/articles/best-crm-for-networking · https://www.linkedin.com/posts/folkhq_whos-your-strongest-connection-folks-activity-6971017337395150849-Lx-k
Attio: https://attio.com/help/reference/attio-101/attios-data-model · https://attio.com/help/reference/attio-101/attios-data-model/understanding-records · https://attio.com/help/reference/attio-101/attios-data-model/understanding-lists · https://novlini.io/blog/how-to-model-complex-data-in-attio-with-custom-objects-and-relationships
Clay/Mesh: https://clay.earth/ · https://techcrunch.com/2023/05/16/clay-introduces-an-ai-helper... · https://muncly.com/clay-earth-review-is-this-an-end-game-personal-crm/
Salesforce Einstein Relationship Insights: https://help.salesforce.com/s/articleView?id=ind.intro_eri.htm · https://www.salesforce.com/news/stories/salesforces-new-ai-agent-identifies-business-connections... · https://trailhead.salesforce.com/content/learn/modules/einstein-relationship-insights-basics
Dex: https://getdex.com/product/ · https://getdex.com/blog/personal-crm-for-networking/
Pipeline/health/next-best-action: https://www.salesforce.com/sales/b2b-sales-tools/ · https://pipeline.zoominfo.com/sales/best-sales-pipeline-management-software-tools · https://www.hyperbound.ai/blog/sales-pipeline-visibility-tools
Obsidian: https://obsidian.md/help/plugins/graph · https://help.obsidian.md/Plugins/Graph+view · https://mindmappingsoftwareblog.com/obsidian-graph-view/
LinkedIn: https://www.linkedin.com/help/linkedin/answer/a545948/view-your-connection-s-connections · https://leaddelta.com/how-to-view-connections-on-linkedin/
Kumu: https://kumu.io/ · https://docs.kumu.io/guides/controls · https://docs.kumu.io/guides/sna-network-mapping.html
Polinode: https://www.polinode.com/info/network-visualization · https://www.polinode.com/product/network-visualization-tool · https://blog.polinode.com/using-polinode-for-social-network-analysis
Dynamics/Attio timeline: https://learn.microsoft.com/en-us/dynamics365/customer-insights/journeys/timeline · https://www.folk.app/articles/best-ai-personal-crm
Boardable: https://boardable.com/resources/top-5-boardable-features-for-nonprofit-board-management-software/ · https://boardable.com/
OnBoard: https://www.onboardmeetings.com/board-life-cycle-management/ · https://www.onboardmeetings.com/
Orbit/community: https://github.com/orbit-love/orbit-model · https://orbit-model.vercel.app/ · https://fastercapital.com/content/Community-funnel-Building-a-Strong-Community-Funnel... · https://www.commsor.com/post/community-building · https://support.commsor.com/article/36-member-audit

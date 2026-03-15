# The Relationship Flywheel Engine

**Date:** 2026-03-15
**Status:** Implementation
**Product:** CivicGraph paid subscription feature (not internal ACT tool)
**Repo:** grantscope (this repo) — available to all customers via API
**Telegram Bot:** @Act_relations_bot (token: 8645017398:AAFESuG06-XkL_LXSyLvKMKDzKCUBG3Z180)

---

## Core Thesis

The world's most important CRM relationship system. Enriching contacts, building relationships, agentic flow for organisations to put all knowledge and intelligence into one place — syncs emails, calendars, events, and people. Fed opportunities to grow strategically and build relationships with all information in one place.

**What's unique:** Clay/Apollo/Salesforce have contact enrichment. But they don't have Australia's grant/foundation/procurement graph. And they don't learn from YOUR specific outcomes.

Real CRM contacts + CivicGraph's 138K entities, 296K relationships, and 673K government contracts in the same database. The flywheel connects them.

---

## 5 Stages

### Stage 1: INGEST
Gmail, LinkedIn (13,810 connections), GHL, Calendar all flow in. **Mostly built.**

### Stage 2: LINK
Match contacts to Australia's graph.

> "You know Sarah at Org X. She sits on the board of Foundation Y which funded $500K in Indigenous programs last year."

Methods:
- ABN matching
- Shared directors
- Grant recipient mapping
- AusTender procurement data

### Stage 3: ANALYZE
- **Warm path finding** — 1st, 2nd, 3rd degree connections
- **Foundation intent modeling** — what they actually fund vs what they say
- **Procurement intelligence** — government contract renewal timing
- **Network gap analysis** — where you have no contacts but should

### Stage 4: ACT
Weekly playbook delivered via **Telegram + email**:

- **Call:** Katie Norman — she knows the CEO of Foundation X which just opened applications
- **Email:** Foundation Y — apps close in 21 days, you know 2 board members
- **Attend:** Impact Investing Summit — 4 target foundation reps confirmed
- **Post:** Tag @FoundationX in your Goods on Country impact story — their board member liked your last 3 posts
- **Connect:** Ask Nicholas's Orange Sky network for intro to Foundation Y

### Stage 5: LEARN
- Track outcomes (did the intro happen? did you win the grant?)
- Learn patterns (Nicholas intros convert 3x better than cold outreach)
- Refine (Foundation X says Indigenous programs but 80% of grants go to universities — deprioritize)

---

## The Self-Improving Part

- **Month 1:** Recommendations from data matching alone
- **Month 6:** Weighted by 100+ real outcomes
- **Month 12:** The model knows your org better than any consultant. "Your hit rate is 3x higher when Nicholas makes the intro — route accordingly."

---

## Implementation Status

~12 days to full flywheel. Contact enricher + relationship intel API already built.

**Completed:**
1. ✅ Entity linkage (Stage 2: LINK) — 381 ghl_contact links + 2,572 person links = 2,953 total
2. ✅ Analyze API (Stage 3: ANALYZE) — warm paths, foundation intent, procurement timing, network gaps

**Next steps:**
3. Weekly playbook v1 (Stage 4: ACT) — Telegram bot + email delivery
4. Outcome tracking (Stage 5: LEARN)
5. Extend fuzzy matching (11K+ LinkedIn contacts still unmatched)

---

## ACT Ecosystem Integration Points

- **CivicGraph DB:** gs_entities, gs_relationships, austender_contracts, foundations, justice_funding, alma_interventions
- **GHL:** Email sequences, contact management, scheduling
- **Telegram:** @Act_relations_bot — weekly playbook delivery
- **Notion:** Content hub, knowledge base
- **Gmail/Calendar:** Contact + event sync (ingest layer)
- **LinkedIn:** 13,810 connections (ingest layer)

---

## What Already Exists (ACT Infra Repo)

**Repo:** `/Users/benknight/Code/act-global-infrastructure`

### Database (Supabase — ACT project, NOT CivicGraph)
| Table | Purpose |
|-------|---------|
| `ghl_contacts` | Master contact record (bidirectional sync with GHL) |
| `ghl_opportunities` | Grants, partnerships, donations (GHL → Supabase read-only) |
| `communications_history` | All comms (email, calendar, SMS, calls, Discord) with AI enrichment |
| `relationship_health` | Temperature 0-100, LCAA stage, sentiment, risk flags (auto-updated) |
| `cultural_protocols` | Indigenous data — NEVER syncs to GHL (elder consent, sacred knowledge, OCAP) |
| `relationship_pipeline` | Unified board with love/money/strategic/urgency scores |
| `user_identities` | Team cross-channel mapping (Discord, Signal, WhatsApp, Telegram, email) |

### Sync Scripts (all working)
- `sync-ghl-to-supabase.mjs` — Bidirectional contact/opportunity sync with cultural protocol enforcement
- `sync-gmail-to-supabase.mjs` — Email → communications_history with contact matching + AI enrichment
- `sync-calendar-full.mjs` — Calendar events → communications_history with attendee matching
- `scripts/lib/ghl-api-service.mjs` — 589-line GHL v2 API wrapper (contacts, opportunities, tags, pipelines)

### Telegram
- `scripts/lib/telegram.mjs` — Simple sendTelegram(message) function (CI notifications only)
- Grammy bot framework in `src/lib/telegram/bot.ts` with Anthropic AI integration
- New bot: @Act_relations_bot for flywheel playbook delivery

### Key Integration Points
- Google: Service account + domain-wide delegation (Gmail/Calendar for 4 mailboxes)
- GHL: Full CRUD + webhook handling + cultural protocol filtering
- Notion: Sync to Supabase
- Xero: OAuth2 financial sync

---

## Technical Architecture

### Stage 2 (LINK) — Contact → Entity Linkage Engine
**Cross-database bridge:** ACT Supabase contacts ↔ CivicGraph gs_entities

Linkage methods:
1. **ABN match** — ghl_contacts.company_name → gs_entities.abn (via ACNC/ABR lookup)
2. **Email domain match** — contact email domain → entity website domain
3. **Org name fuzzy match** — ghl_contacts.company_name → gs_entities.canonical_name (trigram similarity)
4. **Role/board mapping** — contact's org → gs_relationships (director_of, board_member, employee_of)

Output: `contact_entity_links` table mapping ghl_contact_id → gs_entity_id with confidence score + method

### Stage 3 (ANALYZE) — Graph Intelligence
- **Warm paths:** BFS traversal from linked contact → gs_relationships → target entity (1st/2nd/3rd degree)
- **Foundation intent:** Compare foundation stated focus vs actual gs_relationships (grant amounts by sector)
- **Procurement timing:** austender_contracts.contract_end within 90 days → renewal opportunity
- **Network gaps:** High-value entities with zero linked contacts → cold outreach targets

### Stage 4 (ACT) — Weekly Playbook Generator
- Cron job generates playbook from Stage 3 analysis
- Delivers via Telegram (@Act_relations_bot) + email
- Action types: Call, Email, Attend, Post, Connect (with specific context from graph)

### Stage 5 (LEARN) — Outcome Tracking
- `flywheel_outcomes` table: action_id, action_type, recommended_at, completed_at, result, notes
- Feedback loop: outcome success rates weight future recommendations
- Per-introducer conversion tracking (e.g. "Nicholas intros convert 3x")

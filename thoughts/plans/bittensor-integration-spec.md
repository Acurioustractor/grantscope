# Bittensor Integration Spec — GrantScope/CivicScope

**Date:** 2026-03-29
**Status:** Draft — awaiting outreach responses
**Scope:** Consumer integration only. No mining. No validators. No on-chain operations.

---

## 1. Djinn SN103 — Web Attestation for Evidence Packs

### What it does

Djinn uses TLSNotary to cryptographically prove a webpage showed specific content at a specific time. Proofs are validator-attested on Base (L2) and archived to Arweave. This is stronger than screenshots, web archives, or timestamps.

### Why we want it

Our decision packs, due diligence packs, and funder profiles are only as trustworthy as their source data. Today when we say "this foundation funds Indigenous health in NT" — that's our LLM's interpretation of a webpage we scraped at some point. With attestation:

- **Procurement intelligence:** "This AusTender notice was live at [URL] on [date]" — cryptographic proof
- **Foundation profiles:** "Giving focus verified from foundation website on [date]" — not just our enrichment
- **R&D evidence:** Attest our own project pages, git hosting, deployment logs for ATO claims
- **Competitive moat:** "Attested intelligence" is a differentiator no competitor has

### Integration architecture

```
┌─────────────────────┐
│  GrantScope Backend  │
│                      │
│  1. Identify high-   │
│     value source     │──── agent_tasks queue ────┐
│     URLs to attest   │                           │
│                      │                           ▼
│  4. Store proof +    │     ┌──────────────────────────┐
│     update entity    │◄────│  Attestation Worker       │
│     confidence       │     │  (new: attest-worker.mjs) │
│                      │     │                           │
│  5. Display badge    │     │  2. Submit URL to Djinn   │
│     in UI + packs    │     │     (Base smart contract  │
└─────────────────────┘     │      or API when avail)   │
                             │                           │
                             │  3. Receive proof bundle  │
                             │     (TLSNotary + Arweave) │
                             └──────────────────────────┘
```

### Schema additions

```sql
-- New table
CREATE TABLE attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES gs_entities(id),
  source_url text NOT NULL,
  attested_at timestamptz NOT NULL,
  proof_hash text NOT NULL,           -- TLSNotary proof hash
  arweave_tx text,                    -- Arweave archive reference
  chain_tx text,                      -- Base L2 transaction hash
  content_snapshot jsonb,             -- Key extracted claims at attestation time
  status text DEFAULT 'pending',      -- pending | verified | failed | expired
  cost_usd numeric(10,4),            -- Track attestation costs
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_attestations_entity ON attestations(entity_id);
CREATE INDEX idx_attestations_status ON attestations(status);

-- Add attestation count to entity confidence scoring
ALTER TABLE gs_entities ADD COLUMN attestation_count int DEFAULT 0;
```

### Integration with existing patterns

| Existing pattern | How attestation plugs in |
|---|---|
| `PackReadinessBlocker` codes (`missing_confidence`, `missing_source_count`) | Add `missing_attestation` blocker for premium packs |
| `confidenceBadge()` (green/yellow/grey) | Add "attested" tier above "high" — new badge color (blue?) |
| `assembleDueDiligencePack()` | Include attestation proofs in pack payload |
| `agent_tasks` queue + `claim_next_task()` | New task type `attest_source_url` — same queue, new worker |
| Stripe tiers — `governed-proof` module (enterprise only) | Gate attested exports behind `funder` ($499) or `enterprise` ($1,999) |
| `profile_confidence` scoring | Boost confidence score when attestations exist |

### Pricing model for attested intelligence

| Tier | Attestation access |
|---|---|
| community (free) | See attestation badges, can't export proofs |
| professional ($79) | 10 attested entity lookups/month |
| organisation ($249) | 100 attested lookups + attested decision packs |
| funder ($499) | Unlimited attested lookups + API access to proofs |
| enterprise ($1,999) | Bulk attestation + white-label proof embedding |

### Current Djinn integration status

- **No public API/SDK yet.** Integration is via Base smart contract interaction.
- **Attestation product is live** at djinn.gg/attest but may be gated/early access.
- **Action required:** Outreach to Djinn team for API access / partnership.
- **Fallback:** If Djinn API is not available, use TLSNotary directly (open source) with our own verifier — more work but no dependency.

### Cost model (estimated)

- Attestation fee: ~$0.50-2.00 per URL (USDC, paid to Djinn contract)
- At 100 attestations/day = $50-200/day = $1,500-6,000/month
- Break-even: 3-12 funder-tier subscriptions cover attestation costs
- **Unit economics work if attestation is a premium feature, not a default**

---

## 2. Macrocosmos SN13 — Data Enrichment Feed

### What it does

Macrocosmos runs the Data Universe subnet. 350M rows/day of web/social data, scraped and structured by distributed miners. They have a production Python SDK and API.

### Why we want it

569,424 of our 587,307 entities have source_count ≤ 1. We need:
- Foundation website content for the 3,304 with websites but no enrichment
- Social media presence for entity profiles (Twitter, LinkedIn mentions)
- News/media mentions for entity activity signals
- Grant program page changes (stale-record detection)

### Integration architecture

```
┌──────────────────────┐     ┌─────────────────────────┐
│  GrantScope Backend   │     │  Macrocosmos Gravity API │
│                       │     │  (SN13)                  │
│  1. Queue enrichment  │     │                          │
│     tasks for low-    │────►│  2. Query social/web     │
│     source entities   │     │     data by entity name  │
│                       │     │     or URL               │
│  4. Score + ingest    │◄────│                          │
│     accepted deltas   │     │  3. Return structured    │
│                       │     │     results              │
│  5. Reject low-conf   │     └─────────────────────────┘
│     results to review │
└──────────────────────┘
```

### SDK access (already available)

```bash
pip install macrocosmos
```

```python
from macrocosmos import Macrocosmos
client = Macrocosmos(api_key="...")

# Search for entity mentions
results = client.gravity.search(
    query="ACT Foundation Indigenous grants Queensland",
    sources=["twitter", "reddit"],
    limit=50
)
```

### Integration with existing patterns

| Existing pattern | How Macrocosmos plugs in |
|---|---|
| `agent_tasks` queue | New task type `enrich_from_sn13` |
| Multi-provider LLM profiler (MiniMax → Groq → Gemini fallback) | Add Macrocosmos as a data source (not LLM — raw data feed) |
| `source_count` confidence metric | Each accepted Macrocosmos result increments source_count |
| Provenance tracking | Tag source as `sn13_gravity` with query params + timestamp |

### Cost model

- **Free tier:** $5 credits included (enough for proof-of-concept)
- **Paid:** TBD — contact hello@macrocosmos.ai for bulk pricing
- **Estimated:** $0.001-0.01 per query at scale
- At 10,000 queries/month = $10-100/month (trivial vs value added)

### Gating rules (critical)

- **Never write SN13 data directly to production truth tables.**
- All results go to `enrichment_candidates` staging table.
- Auto-accept if confidence > 0.8 AND source_url validates.
- Route everything else to human review queue.
- Tag provenance: `{source: "sn13_gravity", query: "...", retrieved_at: "..."}`.

---

## 3. Implementation Sequence

### Week 1: Outreach + proof of concept
- [ ] Send outreach messages (see companion doc)
- [ ] Sign up for Macrocosmos free tier ($5 credits)
- [ ] Run 50 test queries against foundation names → evaluate result quality
- [ ] Research Djinn attestation contract ABI on Base

### Week 2: Macrocosmos enrichment pipeline
- [ ] Create `enrichment_candidates` staging table
- [ ] Build `enrich-from-sn13.mjs` worker (uses agent_tasks queue)
- [ ] Run against 100 low-source foundations → measure acceptance rate
- [ ] If acceptance > 60%, scale to full 3,304 foundation backfill

### Week 3: Djinn attestation integration
- [ ] Build `attest-worker.mjs` (depends on API access from outreach)
- [ ] Create `attestations` table
- [ ] Attest 50 high-value source pages (AusTender, foundation websites)
- [ ] Add attestation badge to entity profile UI

### Week 4: Monetize
- [ ] Configure Stripe env vars (the 4 that are missing)
- [ ] Gate attested exports behind funder tier
- [ ] Add "attested intelligence" marketing to Goods Workspace
- [ ] Price attested decision packs at 2-3x unattested

---

## 4. What we are NOT doing

- ❌ Running Bittensor miners or validators
- ❌ Holding TAO as treasury asset (yet)
- ❌ Building our own MPC/ZK infrastructure
- ❌ Registering a subnet
- ❌ Sending any sensitive EL/JusticeHub/community data to Bittensor
- ❌ Making core product uptime dependent on subnet economics

---

## 5. Success metrics (90 days)

| Metric | Target |
|---|---|
| Entities enriched via SN13 | 3,000+ |
| Source pages attested | 500+ |
| Stripe billing activated | Yes |
| Paying subscribers (any tier) | 3+ |
| Attestation cost per entity | < $1.00 |
| Enrichment acceptance rate | > 60% |
| Revenue from attested tier premium | > $0 (proof of concept) |

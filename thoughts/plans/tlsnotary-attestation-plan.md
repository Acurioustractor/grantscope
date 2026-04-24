# TLSNotary Self-Hosted Attestation — Plan

**Date:** 2026-03-29
**Status:** Plan — build after SN13 enrichment is validated
**Codebase:** `/Users/benknight/Code/grantscope`

---

## Why self-host instead of waiting for Djinn

- Djinn has no public API, no SDK, no contract ABI — can't integrate today
- TLSNotary is the open-source engine underneath Djinn anyway
- Self-hosted Notary = we control uptime, cost, and data flow
- Trust tradeoff is acceptable: "GrantScope's Notary attested this" is weaker than "decentralised validators attested this" but still cryptographically verifiable
- **Migration path:** when Djinn ships a developer API, swap our Notary for theirs — the proof format and storage layer stay the same

## What TLSNotary gives us

A TLS session between our scraper and a target website (e.g. austender.gov.au) is co-signed by a Notary server using MPC during the TLS handshake. The result is:

1. **Attestation** — Notary signs a commitment (Merkle root) over the TLS transcript
2. **Presentation** — Prover creates a self-contained proof with selective disclosure (can redact sensitive parts)
3. **Verification** — Anyone with the Notary's public key can verify the proof offline

Proofs are binary-serialized, storable as BLOBs, and verifiable without contacting the Notary again.

## Architecture

```
┌────────────────────────────┐
│  GrantScope Enrichment     │
│                            │
│  1. Scrape source URL      │
│     (normal fetch for data)│
│                            │
│  2. If high-value source:  │──── attest-worker ────┐
│     queue attestation task │                       │
│                            │                       ▼
│  5. Store attestation in   │    ┌──────────────────────────┐
│     attestations table     │◄───│  TLSNotary Prover (Rust) │
│                            │    │                          │
│  6. Badge in UI + packs    │    │  3. Replay TLS session   │
└────────────────────────────┘    │     with Notary co-sign  │
                                  │                          │
                                  │  4. Generate Presentation│
                                  │     (proof bundle)       │
                                  └────────────┬─────────────┘
                                               │
                                  ┌────────────▼─────────────┐
                                  │  Notary Server (Rust)     │
                                  │  Self-hosted on Fly.io    │
                                  │  or local Docker          │
                                  │                          │
                                  │  Signs TLS transcripts   │
                                  │  Never sees plaintext    │
                                  └──────────────────────────┘
```

## Implementation phases

### Phase 1: Notary server (3 days)

**Goal:** Self-hosted Notary running and accessible from GrantScope backend.

- Clone `tlsnotary/tlsn` repo
- Build Notary server from `crates/notary/server/`
- Deploy as Docker container (Fly.io or local for dev)
- Configure TLS cert + signing keypair
- Verify health endpoint

**Key decisions:**
- **Fly.io vs local Docker:** Start with local Docker for dev, Fly.io for production. Notary needs to be reachable from wherever the prover runs.
- **Keypair management:** Generate ed25519 signing key, store public key in GrantScope for verification. Publish public key so customers can verify independently.

### Phase 2: Prover worker (5 days)

**Goal:** Node.js/Rust worker that attests source URLs and stores proofs.

Two options:
- **Option A: `tlsn-js` (JavaScript)** — runs in Node.js via WASM. Simpler integration with existing pipeline. Slower (~5-15s per attestation per TLSNotary benchmarks).
- **Option B: Rust binary** — called via `execFile` like other agents. Faster (~2-5s per attestation). More complex build.

**Recommendation:** Start with `tlsn-js` (Option A) for speed of integration. Move to Rust if performance matters.

```javascript
// Conceptual flow using tlsn-js
import { Prover } from 'tlsn-js';

async function attestUrl(url, notaryUrl) {
  const prover = new Prover({ notaryUrl });

  // Connect to target and perform TLS handshake with Notary co-signing
  const session = await prover.connect(url);

  // Send HTTP GET
  await session.send(`GET ${new URL(url).pathname} HTTP/1.1\r\nHost: ${new URL(url).hostname}\r\n\r\n`);
  const response = await session.recv();

  // Generate presentation (proof)
  const presentation = await session.createPresentation({
    // Selectively disclose: response body, but redact cookies/auth headers
    disclose: ['response_body', 'response_headers.content-type', 'response_headers.date'],
  });

  return {
    proof: presentation.serialize(), // Binary proof bundle
    proofHash: sha256(presentation.serialize()),
    notaryPublicKey: prover.notaryPublicKey,
    attestedAt: new Date().toISOString(),
    responseSnapshot: response.body.slice(0, 10000),
  };
}
```

### Phase 3: Storage + UI (3 days)

**Goal:** Attestation proofs stored, badges displayed, packs enhanced.

Uses the `attestations` table from the SN13 migration (already designed in bittensor-integration-spec.md).

UI integration points (all already exist, just need attestation variant):
- `confidenceBadge()` → add "attested" state (blue badge)
- `PackReadinessBlocker` → add `missing_attestation` code for premium packs
- `assembleDueDiligencePack()` → include proof hash + verification link
- Entity profile pages → "Sources" section shows attested vs unattested sources

### Phase 4: Monetize (2 days)

- Gate attested exports behind `funder` tier ($499/mo) using existing `ModuleGate`
- Add "Attested Intelligence" section to marketing
- Price attested decision packs at 2-3x unattested

## What to attest (priority order)

| Source type | Volume | Value | Priority |
|---|---|---|---|
| AusTender contract notices | ~1,000 high-value | Procurement intelligence | 1 |
| Foundation websites (giving focus pages) | ~3,000 | Funder profile accuracy | 2 |
| ACNC annual information statements | ~10,000 | Financial verification | 3 |
| State grant program pages | ~500 | Grant deadline/eligibility proof | 4 |
| Our own project pages (R&D evidence) | ~50 | ATO R&D tax claim support | 5 |

## Cost model

| Component | Cost |
|---|---|
| Notary server (Fly.io shared-cpu) | ~$5/mo |
| Compute per attestation (WASM) | ~0.01 CPU-seconds |
| Storage per proof (~5-50KB each) | Negligible in Supabase |
| **Total for 1,000 attestations/mo** | **~$10/mo** |

This is dramatically cheaper than Djinn (est. $0.50-2.00/attestation) because we're not paying subnet fees. The tradeoff is decentralisation — our Notary vs their validator network.

## Migration to Djinn (when ready)

When Djinn ships a developer API:
1. Add Djinn as an alternative attestation provider in `attest-worker`
2. For new attestations: prefer Djinn (decentralised trust) over self-hosted
3. Existing self-hosted proofs remain valid — they're still TLSNotary proofs
4. Marketing upgrade: "Verified by Bittensor validator network" badge vs "Verified by GrantScope Notary"
5. Price the Djinn-backed tier higher (decentralised trust premium)

## Dependencies

- SN13 enrichment pipeline working first (validates the staging table pattern)
- Stripe billing activated (to monetize attested tier)
- Rust toolchain available for Notary server build (or use pre-built Docker image)

## What we're NOT building

- ❌ ZK proofs or zero-knowledge settlement
- ❌ On-chain smart contracts
- ❌ Threshold MPC key sharing (that's Djinn's layer)
- ❌ Arweave archival (nice-to-have later, not needed for MVP)
- ❌ Our own Bittensor subnet

## Timeline

| Phase | Duration | Depends on |
|---|---|---|
| 1. Notary server | 3 days | Rust/Docker available |
| 2. Prover worker | 5 days | Phase 1 |
| 3. Storage + UI | 3 days | Phase 2 + attestations table |
| 4. Monetize | 2 days | Stripe activation + Phase 3 |
| **Total** | **~13 days** | Start after SN13 enrichment validated |

## Success criteria

- [ ] Notary server running and healthy
- [ ] Can attest any public HTTPS URL and get a verifiable proof
- [ ] Proofs stored in `attestations` table with entity linkage
- [ ] "Attested" badge visible on entity profiles
- [ ] Decision packs include proof hashes for attested sources
- [ ] At least 100 high-value source pages attested
- [ ] Attested exports gated behind paid tier

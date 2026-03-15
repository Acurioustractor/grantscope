# Five Safes Compliance: Pathway for CivicGraph

## What Is Five Safes?

A risk management framework used by the ABS, AIHW, and state data custodians to govern access to sensitive data. No formal certification exists — it's assessed per-engagement by each data custodian.

| Dimension | What It Means | What CivicGraph Needs |
|---|---|---|
| **Safe People** | Trained, vetted, accountable users | Staff criminal checks, Five Safes training (free via CADRE), confidentiality deeds |
| **Safe Projects** | Clear public benefit, approved purpose | Ethics approval (HREC), documented research questions, data minimisation plan |
| **Safe Settings** | Secure environment, no data extraction | IRAP-assessed environment OR ABS DataLab access. MFA, logging, no export capability |
| **Safe Data** | De-identified, minimised, proportionate | Statistical disclosure controls, cell suppression, perturbation |
| **Safe Outputs** | Reviewed before release, no re-identification risk | Output review by trained personnel, documentation of disclosure risk assessment |

## Current State: CivicGraph Today

CivicGraph currently handles **only public data** — no person-level sensitive data. This means Five Safes compliance is NOT required for current operations. It becomes relevant only if we want to:

1. Host state/federal linked data inside CivicGraph
2. Become an Accredited Data Service Provider under the DATA Act
3. Bid on government contracts that require PROTECTED-level data handling

## Phased Compliance Pathway

### Phase 0: Quick Wins (Month 1-3, <$10K)

These are free or near-free credibility signals:

- [ ] Complete CADRE Five Safes training (free, online) — all staff
- [ ] Document existing security controls mapped to Essential Eight
- [ ] Publish a Five Safes self-assessment on the CivicGraph website
- [ ] Draft template Data Sharing Agreement and Privacy Impact Assessment
- [ ] Join Trusted Information Sharing Network (TISN) sector group
- [ ] Document data governance policy (classification, retention, access controls)

**Outcome:** Can credibly reference Five Safes in conversations with data custodians.

### Phase 1: Table Stakes (Month 3-12, ~$100-150K)

Minimum to be taken seriously by state data custodians:

| Item | Cost | Timeline | Why |
|---|---|---|---|
| **ISO 27001 certification** | $40-60K | 6-9 months | Globally recognised, expected baseline |
| **Essential Eight Maturity Level 1** | $25-40K | 3-6 months | ASD baseline, government expectation |
| **Azure Australia (sovereign hosting)** | $10-20K setup + $3-5K/mo | 2-4 weeks | IRAP PROTECTED-certified, data sovereignty |
| **University partnership** | $5-15K | 3-6 months | Leverages their DATA Act accreditation |
| **State agency pilot** | $20-40K (staff time) | 6-12 months | Demonstrate capability on lower-sensitivity data |

**Outcome:** Can apply for state data custodian access, bid on contracts requiring ISO 27001, partner with universities for PLIDA/NDDA access.

### Phase 2: Full Government Compliance (Month 12-36, ~$275-500K)

Required only if CivicGraph wants to become a data service provider handling PROTECTED-level data:

| Item | Cost | Timeline | Why |
|---|---|---|---|
| **IRAP assessment** | $100-200K | 6-12 months | Required for PROTECTED classification |
| **Essential Eight Maturity Level 2-3** | $50-100K | 6-12 months | Higher assurance controls |
| **DATA Act accreditation** | $50-100K (legal + governance) | 12-24 months | Requires 2-3 year track record |
| **Dedicated secure research environment** | $50-100K build + $20-40K/yr | 6-12 months | Five Safes "Safe Settings" — no export, full logging |
| **Annual compliance maintenance** | $80-120K/yr ongoing | Continuous | Audits, penetration testing, staff training |

**Outcome:** Can host sensitive linked data, bid on major government data contracts, operate as an Accredited Data Service Provider.

## Cost Summary

| Pathway | Initial Investment | Annual Ongoing | Timeline |
|---|---|---|---|
| Phase 0 (credibility) | <$10K | $0 | 1-3 months |
| Phase 1 (table stakes) | $100-150K | $40-60K | 6-12 months |
| Phase 2 (full compliance) | $275-500K | $120-220K | 24-36 months |

## Recommendation

**Start Phase 0 immediately (free). Begin Phase 1 only when a specific government contract or partnership requires it. Defer Phase 2 until revenue justifies it.**

CivicGraph's current value proposition is built on **public data, linked intelligently**. Five Safes compliance is a growth option, not a prerequisite. The area-level life course proxy (see companion assessment) delivers 80% of the analytical value without requiring any sensitive data access.

The strategic sequence:
1. Prove value with public data (now)
2. Win a state agency pilot on public/aggregate data (6-12 months)
3. Use the pilot to justify Phase 1 investment (12-18 months)
4. Pursue Five Safes compliance when a specific PROTECTED contract demands it (24+ months)

Don't build the vault before you have something to put in it.

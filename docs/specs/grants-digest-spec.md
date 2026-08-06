# Grants alerting digest — spec (wayfinder #160)

Decided 2026-08-06 grilling session. Part of map #158. Standing decision from
charting holds: notifications are email digest + GHL tasks ONLY — the desk
stays the one place you check; the digest is a pull-back-in, never a second
queue.

## Contents — two sections, strictly desk-derived

Nothing appears in the digest that is not on the desk. No digest-only
thresholds exist; the desk decision-row thresholds are reused verbatim so the
two surfaces can never disagree about what matters.

1. **New decisions due** — Signals / Grant Rounds that crossed the existing
   desk thresholds (grants: deadline ≤ 30d or fit ≥ 85; funders: fit ≥ 85;
   open-stage buyers always) since the last sent digest.
2. **Going due / overdue** — desk rows entering the urgent window:
   Obligations overdue or due ≤ 7d; Asks with a dated, due next action;
   People/watches with review-by ≤ 7d.

Each row is one line plus a deep link into the desk. The subject line carries
the counts ("3 new decisions, 2 going due").

## Cadence — daily delta-only + Monday heartbeat

Daily check at 07:00 Brisbane; **send only if there is a delta** (something
new crossed a threshold, or something newly entered the due/overdue window).
Monday sends regardless, as a week-start summary even when quiet ("nothing
new, 4 open decisions sitting on the desk"). Rationale: fixed daily trains
ignoring it; weekly-only can sit on a ≤30d-deadline grant for six days.

## One digest, org-wide

The desk is one; its mirror is one. Rows carry project chips like desk rows.
Per-project digests would recreate the sibling-queue problem in email form.
Recipients: Ben (Nic optional).

## Send mechanism

pg_cron (already in use for MV refresh) fires a Supabase edge function that:
1. composes both sections from the same services the desk reads
   (`getDeskObligations` etc. — one source of truth, no parallel queries);
2. computes "new since last digest" from `digest_log`;
3. sends via the **GHL email API** as a plain transactional email — no
   workflow, no tags, no contact-record involvement, so it cannot interact
   with newsletter machinery;
4. records the send (rows included, timestamp) in `digest_log`.

**Pre-approved escape hatch:** GHL-as-sender is pragmatic, not principled. If
digest sends create contact-activity noise or deliverability problems, switch
the edge function to a Resend free-tier key without revisiting this spec.

## Relation to the GHL tasks bridge (#161)

The digest is the read channel; GHL tasks (#161, separate ticket) are the
act channel. This spec deliberately does not create tasks.

# Community records live in Supabase (work-truth side of ADR 0003)

A Community is structural knowledge, like Person↔Org Roles. Its truth does not
change where correspondence happens (GHL's claim) nor even primarily where
work happens — it barely changes at all once minted. GHL cannot model place
records (it has contacts, not geography), so any GHL home would be a
write-through cache with worse ergonomics, the same failure ADR 0003 already
rejected for Obligations.

So: `act_communities` and its edge tables are Supabase-native state. GHL
involvement is zero. CivicGraph geography and funding evidence (LGA/SEIFA/
contract joins) remain read-only annotations with `last_synced_at` ages,
per the standing data-trust rules.

The ticket (#159) invited a challenge to this presumption; the challenge
fails on the ownership test above.

Decided 2026-08-06 (Ben, grilling session, wayfinder ticket #159; Ben
delegated the calls and confirmed the resolved tree).

# The Ask lives in GHL; CivicGraph annotates, never adjudicates

An Ask (a committed chase for money) spans four systems: GHL (relationship),
CivicGraph (discovery evidence), Xero (dollars), Notion (the artefact). We
decided GHL owns the Ask's existence and state — not in GHL means not an Ask,
and on any state disagreement GHL wins silently. The alternative (CivicGraph as
master, syncing state out) was rejected because relationship truth is created
where the emails and calls happen, and two writable masters guarantee the
ACF-style drift ("approach_now" in discovery, "cooling" in GHL) that this
decision exists to kill. Consequence: every GHL-derived fact rendered in
CivicGraph must carry `last_synced_at` and show a stale badge past 24h, and the
push-to-GHL affordances are understood as *minting the Ask*, not exporting data.

Decided 2026-08-05 (Ben, grilling session).

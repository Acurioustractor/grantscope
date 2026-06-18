-- person_identities — disambiguated person identities for name-keyed megamerges.
--
-- Additive / non-destructive. Maps each person_roles row to a stable identity_key
-- so the person MVs can aggregate by real identity instead of by raw normalised
-- name. Nominee/trustee blocks are flagged so they can be excluded from
-- individual-governance rankings (decision 2026-06-19).
--
-- Populated by scripts/build-person-identities.mjs (clustering core:
-- scripts/lib/person-cluster.mjs). Roles with no row here keep their
-- name-keyed identity downstream (COALESCE). The shipped board-count guard
-- (#90/#91) is unaffected.
--
-- Validated by scripts/person-disambig-probe.mjs before populate.

CREATE TABLE IF NOT EXISTS person_identities (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id                uuid NOT NULL REFERENCES person_roles(id) ON DELETE CASCADE,
  person_name_normalised text NOT NULL,
  identity_key           text NOT NULL,                  -- stable: "<NAME>#<base36 hash of sorted member ABNs>"
  cluster_size           integer NOT NULL,
  is_nominee_block       boolean NOT NULL DEFAULT false, -- trustee/nominee block → exclude from individual rankings
  confidence             text NOT NULL,                  -- high | medium | low
  method                 text NOT NULL DEFAULT 'codir-graph-v1',
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_identities_confidence_chk CHECK (confidence IN ('high', 'medium', 'low'))
);

-- one identity per role; enables idempotent ON CONFLICT (role_id) upserts on rebuild
CREATE UNIQUE INDEX IF NOT EXISTS person_identities_role_id_uidx ON person_identities (role_id);
CREATE INDEX IF NOT EXISTS person_identities_identity_key_idx   ON person_identities (identity_key);
CREATE INDEX IF NOT EXISTS person_identities_name_idx           ON person_identities (person_name_normalised);
CREATE INDEX IF NOT EXISTS person_identities_nominee_idx        ON person_identities (is_nominee_block) WHERE is_nominee_block;

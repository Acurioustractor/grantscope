-- Seed the three Communities Ben named in the #158 charting session
-- (2026-08-06) — these are his minting decisions, recorded, not dataset rows.
-- Idempotent on (org_profile_id, slug).

insert into act_communities (org_profile_id, name, slug, notes, minted_by)
select o.id, v.name, v.slug, v.notes, 'ben-charting-2026-08-06'
from org_profiles o,
  (values
    ('Barkly', 'barkly', 'Tennant Creek and the Barkly region — Goods channels and delivery relationships.'),
    ('Urapuntja (Utopia)', 'utopia', 'Utopia homelands, Alyawarre and Anmatyerre country.'),
    ('Bwgcolman (Palm Island)', 'palm-island', 'Palm Island community.')
  ) as v(name, slug, notes)
where o.slug = 'act'
on conflict (org_profile_id, slug) do nothing;

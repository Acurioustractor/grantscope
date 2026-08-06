
-- psql-created objects don't inherit Supabase's default grants — grant
-- explicitly or every service-role read fails with permission denied.
grant all on table act_people, act_person_roles to service_role;

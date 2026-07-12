-- Allow server-side service clients to write normalized context sweep results.
-- Browser clients are not granted direct access to this table.

grant all on table public.opportunity_context_events to service_role;

-- db-saturation-snapshot.sql
-- Run via psql (Supavisor pooler, 5432) to capture WHO is holding the shared box
-- at the moment the PostgREST pool (gsql / exec_sql, user 'authenticator') goes unreachable.
-- The two pools are independent, so this answers even during a PostgREST-side blip.
\pset pager off
\pset border 1

-- (1) Pool / connection summary — how full is each side, any lock waits.
SELECT now()                                                                   AS at,
       count(*)                                                                AS total,
       count(*) FILTER (WHERE state = 'active')                                AS active,
       count(*) FILTER (WHERE usename = 'authenticator')                       AS postgrest,
       count(*) FILTER (WHERE usename = 'authenticator' AND state = 'active')  AS pgrst_active,
       count(*) FILTER (WHERE state = 'idle in transaction')                   AS idle_txn,
       count(*) FILTER (WHERE wait_event_type = 'Lock')                        AS waiting_on_lock
FROM pg_stat_activity;

-- (2) Every non-idle backend: who is actually working a slot, what query, how long, what wait.
SELECT pid,
       usename,
       application_name                                                AS app,
       host(client_addr)                                               AS client,
       state,
       wait_event_type                                                 AS wait_t,
       wait_event,
       round(extract(epoch FROM now() - query_start))                  AS dur_s,
       left(regexp_replace(coalesce(query, ''), '\s+', ' ', 'g'), 180) AS query
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND state IS NOT NULL          -- drop pure background workers (checkpointer/autovacuum launcher/etc.)
  AND state <> 'idle'            -- keep only backends running a statement (active / idle-in-transaction)
ORDER BY dur_s DESC NULLS LAST   -- longest-running first = likeliest burst culprit
LIMIT 40;

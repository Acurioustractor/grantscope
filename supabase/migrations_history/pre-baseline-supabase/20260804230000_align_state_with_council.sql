-- Make an organisation's state agree with the council it sits in.
--
-- The place profile listed Anangu Pitjantjatjara Yankunytjatjara twice, once
-- under SA and once under NT, because four APY organisations kept state='NT'
-- while being placed in a South Australian council. The state came from
-- postcode 0872, which spans three states; the council came later from the
-- organisation's own name or its recipient record, and nothing reconciled the
-- two.
--
-- 498 organisations nationally sit in a council belonging to a different state
-- than their own state field. A council belongs to exactly one state, so where
-- the council is known it is the better evidence — it was derived from a
-- locality, while the state was inherited from a postcode that may span
-- borders.
--
-- Only councils that sit unambiguously in one state are used.

WITH lga_state AS (
  SELECT lga_name, min(state_name) AS state_name
    FROM public.abs_locality_lga
   GROUP BY lga_name
  HAVING count(DISTINCT state_name) = 1
)
UPDATE public.gs_entities e
   SET state = CASE l.state_name
         WHEN 'New South Wales' THEN 'NSW'
         WHEN 'Victoria' THEN 'VIC'
         WHEN 'Queensland' THEN 'QLD'
         WHEN 'South Australia' THEN 'SA'
         WHEN 'Western Australia' THEN 'WA'
         WHEN 'Tasmania' THEN 'TAS'
         WHEN 'Northern Territory' THEN 'NT'
         WHEN 'Australian Capital Territory' THEN 'ACT'
       END
  FROM lga_state l
 WHERE l.lga_name = e.lga_name
   AND e.state IS NOT NULL
   AND e.state IS DISTINCT FROM CASE l.state_name
         WHEN 'New South Wales' THEN 'NSW'
         WHEN 'Victoria' THEN 'VIC'
         WHEN 'Queensland' THEN 'QLD'
         WHEN 'South Australia' THEN 'SA'
         WHEN 'Western Australia' THEN 'WA'
         WHEN 'Tasmania' THEN 'TAS'
         WHEN 'Northern Territory' THEN 'NT'
         WHEN 'Australian Capital Territory' THEN 'ACT'
       END;

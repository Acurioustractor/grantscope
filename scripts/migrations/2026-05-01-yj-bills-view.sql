-- v_qld_yj_bills_active
-- Derives bill names + debate volume from civic_hansard body_text for QLD YJ-
-- relevant bills. No new scrape needed; this is a free win from existing data.

CREATE OR REPLACE VIEW public.v_qld_yj_bills_active AS
WITH raw_mentions AS (
  SELECT
    sitting_date,
    speaker_name,
    speaker_party,
    -- Capture the bill name + year. Anchor on the trailing "Bill YYYY" or
    -- "Amendment Bill YYYY" pattern; pull back ~80 chars of leading words.
    regexp_matches(body_text, '\m([A-Z][A-Za-z][^.\n]{6,120}?(?:Amendment Bill|Bill) 20[12][0-9])', 'g') AS m
  FROM public.civic_hansard
  WHERE jurisdiction = 'QLD'
    AND body_text ~ '(youth justice|adult crime|youth detention|making queensland safer|breach of bail|young offender|child criminal)'
),
cleaned AS (
  SELECT
    -- Strip common preambles ("Tabled paper :", "I rise to speak to the",
    -- "I am pleased to introduce the", electorate-name prefixes, etc.)
    trim(both ' ' from
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              m[1],
              '^(?:Tabled paper\s*:\s*|I rise (?:to speak (?:to|in support of|in strong support of|to\s+the|to\s+oppose) the|in (?:strong )?support of the|tonight in strong support of the|today to support the|to oppose the)\s+|I am pleased to introduce the\s+|.+?electorate(?:\s+\(.+?\))?\s+(?:to speak |in support of the |on the |speaking on the )?)', '', 'i'
            ),
            '^(?:to (?:speak|support|introduce|oppose|debate)|on|in)\s+(?:the|on)?\s+', '', 'i'
          ),
          '^(?:on the |the )', '', 'i'
        ),
        '\s+', ' ', 'g'
      )
    ) AS bill_name,
    sitting_date,
    speaker_name,
    speaker_party,
    m[1] AS raw_match
  FROM raw_mentions
)
SELECT
  bill_name,
  COUNT(*)::int AS mentions,
  COUNT(DISTINCT speaker_name)::int AS distinct_speakers,
  ARRAY_AGG(DISTINCT speaker_party) FILTER (WHERE speaker_party IS NOT NULL) AS parties,
  MIN(sitting_date::date) AS first_mention,
  MAX(sitting_date::date) AS last_mention,
  CASE
    WHEN bill_name ~* '(adult crime|adult time|youth crime|youth detention|young offender|breach of bail|making queensland safer|youth justice)' THEN true
    ELSE false
  END AS is_yj_specific
FROM cleaned
WHERE length(bill_name) BETWEEN 12 AND 200
  AND bill_name !~ '^[a-z]'  -- starts with capital
GROUP BY bill_name
HAVING COUNT(*) >= 1
ORDER BY is_yj_specific DESC, mentions DESC;

COMMENT ON VIEW public.v_qld_yj_bills_active IS
  'Bill names and debate volume extracted from civic_hansard body_text for QLD YJ-relevant bills. Read for the structural list of legislation actually being debated. Bill names are best-effort regex from PDF text — verify against parliament.qld.gov.au before quoting.';

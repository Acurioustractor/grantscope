-- Add URLs to PRF open programs
UPDATE foundations SET
  open_programs = '[
    {"name":"Just Futures","via":"Australian Communities Foundation","focus":"Justice-involved youth, parents in/post custody, First Nations","url":"https://communityfoundation.org.au/grant-rounds/just-futures/"},
    {"name":"Strengthening Early Years","via":"Australian Communities Foundation","focus":"Families with children prenatal to school entry","url":"https://www.communityfoundation.org.au/support/sey"},
    {"name":"PRF Fellowship","amount":"$250,000 over 18 months","cycle":"Annual, Oct-Nov applications","url":"https://www.paulramsayfoundation.org.au/news-resources/2026-fellowships"},
    {"name":"Specialist DFV Programs","amount":"$13.6M to 58 orgs","focus":"Domestic and family violence","url":"https://communityfoundation.org.au/grant-rounds/dfv/"}
  ]'::jsonb
WHERE acnc_abn = '32623132472';

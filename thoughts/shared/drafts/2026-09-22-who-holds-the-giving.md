# Who holds the giving

*Draft, 2026-09-22. Every figure is from the ACNC Annual Information Statements, each charity's latest filing for 2022 to 2024, queried from CivicGraph. Method and limits at the end.*

The 53,879 charities in our data took in $192.8 billion in a year. Nearly half of it, $95.3 billion, came from government. The question worth asking is who that money is organised around.

Follow it and it comes to rest in the same places every time. Universities. Catholic church and education bodies. Hospital groups. Of the twenty largest charities in the country, nineteen are one of these three. The twentieth is Queensland Sugar Limited. The Victorian Catholic Education Authority, $3.63 billion. The University of Sydney, $3.58 billion. Monash, $3.47 billion. St John of God Health Care, $2.10 billion.

## The box anyone can tick

When a charity registers, it ticks the people it serves. 12,574 charities ticked Aboriginal and Torres Strait Islander people. Together they took in $81.5 billion.

The biggest of them are the University of Sydney, Monash, RMIT, Deakin and Catholic Education Western Australia.

How much of that $81.5 billion reached organisations controlled by Aboriginal and Torres Strait Islander communities? Count only the 209 we are sure of, and it is $1.26 billion: a cent and a half in the dollar. Count every organisation that might be, 784 of them, and it is $5.23 billion: six cents. Count it any way you like. It never reaches seven.

The donations are thinner still. Charities that say they serve Aboriginal people received $4.07 billion in gifts. Between $24 million and $232 million of it went to community-controlled organisations. At most, six cents in the dollar.

The money that speaks in the name of Aboriginal people is held, almost entirely, by institutions Aboriginal people do not run.

## The school's own foundation

1,311 non-government schools and school operators report to the charity regulator. In one year they received $23.66 billion from government and $365 million in donations, ran a combined surplus of $1.84 billion, and sat on net assets of $44.61 billion.

Behind many sits a second charity: the school's own building fund, scholarship fund, library fund or foundation. We counted 537. They hold $2.55 billion, and took $149.5 million in donations in a year. Penleigh and Essendon Grammar's development foundation holds $135 million. Prince Alfred College's endowment fund, $123.5 million. The Scotch College Foundation, $118 million. The Newington Foundation, $113 million.

School building funds are a category of deductible gift recipient written into the tax law (Income Tax Assessment Act 1997, item 2.1.10). A gift to one is partly paid for by everyone else's tax, and the dollar stays inside the gate.

In the same year, the 209 organisations we are sure are Aboriginal community controlled received $24 million in donations between them. Aboriginal corporations registered with ORIC and reporting to the ACNC received $2.9 million. School funds took six times the first and fifty times the second.

## Who sits at the table

1,305 people sit on the boards of Australia's 200 largest charities. 127 of them also sit on the board of a charity that gives away a million dollars or more a year. The densest overlaps run through Catholic networks, universities and medical research. One in ten of the people running the places where the money lands also helps decide where the giving goes.

Pay is harder to see. The ACNC publishes one total for each charity's senior staff, not individual salaries. Monash reports $17.0 million across 45 key people. St John of God, $12.4 million across 38. The University of Adelaide, $9.3 million across 18.

## What this means for the work on the ground

A charity ticks a box to say it serves Aboriginal and Torres Strait Islander people. Nobody checks the box against where the money lands. Ninety-four cents in the dollar, at least, lands somewhere other than the organisations those communities run.

The money is there. It is organised around the institutions that already hold it, and the people who sit across their boards.

---

## Method and limits

- **Source:** ACNC Annual Information Statements, latest filing per charity for 2022 to 2024 (53,879 charities). Queried 2026-09-22.
- **Scope:** 53,879 charities with both a register entry and a filing; all filings together total $246.4 billion.
- **Excluded:** Lightning Ridge Local Aboriginal Land Council's filing reports $54.67 billion in revenue, almost certainly a units error. Indigenous Business Australia and the Indigenous Land and Sea Corporation are government bodies and are not counted as community controlled.
- **Community controlled** is judged by Jev (TypeSafe's decision model) from each charity's name and its own ACNC description, against the Closing the Gap definition, and cross-checked with CivicGraph's `is_community_controlled` flag. Jev cannot see board composition, so it is unsure about many real community-controlled organisations; that is why the figure is a range. The range, 1.5 to 6.4 cents, comes from Jev's judgements: the floor counts only organisations Jev judged community controlled at 90% confidence or more; the ceiling adds every organisation either our flag or Jev (at any confidence) calls community controlled, minus the ones Jev is confident are mainstream or government, and minus Indigenous Business Australia and the Indigenous Land and Sea Corporation.
- **Non-government schools and school funds** are judged by Jev at 90% confidence or more; 4,203 education charities it was less sure of are left out, so school totals are a floor. Includes Catholic systemic school operators.
- **ORIC donations** undercount: most ORIC corporations do not report to the ACNC.
- **Main sector** is judged by Jev from each charity's own description, one sector per charity at 90% confidence or more, so sector totals do not double count. The 14,137 charities it was less sure of are reported separately, not spread across the others.
- **Grantmakers** are charities reporting $1M or more in grants and donations paid in their own ACNC filing (817 of them). An earlier version used `foundations.total_giving_annual`, which the ACNC importer fills from a charity's size band. That is an estimate, not reported giving, and it is not used here.
- **Board overlaps** come from ACNC responsible-person records, with nominee blocks removed. Corporate directorships are not yet in the data, so links to company boards are not shown.
- **Not measured:** the reporting burden on community organisations. An earlier draft argued it without evidence; that paragraph was cut.

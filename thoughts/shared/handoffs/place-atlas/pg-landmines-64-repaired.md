# The 64 postcode_geo landmine pairs — repaired 2026-08-09 (migration 20260809220000)

Class signature: SAL/locality authority names the town's own council; postcode_geo's
legacy `lga_code`/`lga_name` named a neighbour or postal hub. All 64 repaired to the
SAL value in the tranche-1 migration. `cands` = tonight's street-line candidates at
that pair (how it was surfaced), not total exposure.

Contamination audit target: any entity placed with `lga_name` = the OLD pg value in
these postcodes (queued, Ben-ratified). Note some pairs are ambiguous at postcode
level — other localities of the same postcode may legitimately map to the old LGA
(e.g. Eastwood@5063 is genuinely Burnside while Parkside/Highgate@5063 are Unley).

| town | st | pc | SAL says (now in pg) | pg said (old, wrong) | cands |
|---|---|---|---|---|---|
| NORWOOD | SA | 5067 | Norwood Payneham and St Peters | Burnside | 30 |
| CLAREMONT | WA | 6010 | Claremont | Cottesloe | 28 |
| GUILDFORD | NSW | 2161 | Cumberland | Fairfield | 24 |
| BASSENDEAN | WA | 6054 | Bassendean | Swan | 21 |
| BALACLAVA | VIC | 3183 | Port Phillip | Glen Eira | 18 |
| BLACKWOOD | SA | 5051 | Mitcham | Onkaparinga | 16 |
| WALKERVILLE | SA | 5081 | Walkerville | Prospect | 14 |
| PARKSIDE | SA | 5063 | Unley | Burnside | 14 |
| PARADISE | SA | 5075 | Campbelltown (SA) | Port Adelaide Enfield | 12 |
| QUEENSCLIFF | VIC | 3225 | Queenscliffe | Greater Geelong | 11 |
| PEAK HILL | NSW | 2869 | Parkes | Narromine | 11 |
| ST MARYS | SA | 5042 | Mitcham | Marion | 10 |
| HIGHFIELDS | QLD | 4352 | Toowoomba | Goondiwindi | 10 |
| NORTH BEACH | WA | 6020 | Stirling | Joondalup | 9 |
| BRIGHTON | SA | 5048 | Holdfast Bay | Marion | 9 |
| WARBURTON | WA | 6431 | Ngaanyatjarraku | Kalgoorlie-Boulder | 8 |
| GIRRAWEEN | NSW | 2145 | Cumberland | Parramatta | 8 |
| HIGHGATE | SA | 5063 | Unley | Burnside | 7 |
| CAMDEN PARK | SA | 5038 | West Torrens | Marion | 7 |
| THORNTON | NSW | 2322 | Maitland | Cessnock | 7 |
| MELROSE PARK | SA | 5039 | Mitcham | Marion | 6 |
| BRIDGEWATER | TAS | 7030 | Brighton | Northern Midlands | 6 |
| ENFIELD | NSW | 2136 | Burwood | Strathfield | 6 |
| GREENMOUNT | WA | 6056 | Mundaring | Kalamunda | 6 |
| MYRTLE BANK | SA | 5064 | Unley | Mitcham | 5 |
| CARRAMAR | NSW | 2163 | Fairfield | Canterbury-Bankstown | 5 |
| BINNA BURRA | NSW | 2479 | Byron | Ballina | 4 |
| GILBERTON | SA | 5081 | Walkerville | Prospect | 3 |
| LAURA | SA | 5480 | Northern Areas | Mount Remarkable | 3 |
| DUNOLLY | VIC | 3472 | Central Goldfields | Mount Alexander | 3 |
| TALBOT | VIC | 3371 | Central Goldfields | Hepburn | 3 |
| KINGSTON | VIC | 3364 | Hepburn | Central Goldfields | 3 |
| NORTH HAVEN | NSW | 2443 | Port Macquarie-Hastings | Mid-Coast | 3 |
| WOODBRIDGE | WA | 6056 | Swan | Kalamunda | 2 |
| CHELTENHAM | NSW | 2119 | Hornsby | Parramatta | 2 |
| CHISHOLM | NSW | 2322 | Maitland | Cessnock | 2 |
| BURNSIDE | VIC | 3023 | Melton | Brimbank | 2 |
| CLARENDON | VIC | 3352 | Moorabool | Corangamite | 2 |
| BLACKWOOD | VIC | 3458 | Moorabool | Macedon Ranges | 2 |
| BLACKBUTT | QLD | 4314 | South Burnett | Toowoomba | 2 |
| MURPHYS CREEK | QLD | 4352 | Lockyer Valley | Goondiwindi | 2 |
| EXETER | SA | 5019 | Port Adelaide Enfield | Charles Sturt | 2 |
| HERNE HILL | WA | 6056 | Swan | Kalamunda | 2 |
| WISHART | NT | 0822 | Unincorporated NT | Palmerston | 2 |
| DROMEDARY | TAS | 7030 | Brighton | Northern Midlands | 2 |
| PHEASANT CREEK | VIC | 3757 | Murrindindi | Nillumbik | 1 |
| JAMIESON | VIC | 3723 | Mansfield | Murrindindi | 1 |
| FALLS CREEK | VIC | 3699 | Unincorporated Vic | East Gippsland | 1 |
| KINGS PARK | WA | 6005 | Perth | Vincent | 1 |
| BLACK RANGE | VIC | 3381 | Northern Grampians | Ararat | 1 |
| ENFIELD | VIC | 3352 | Golden Plains | Corangamite | 1 |
| ASHFIELD | WA | 6054 | Bassendean | Swan | 1 |
| BLACK MOUNTAIN | NSW | 2365 | Armidale Regional | Clarence Valley | 1 |
| HAMILTON | TAS | 7140 | Central Highlands (Tas.) | West Coast | 1 |
| MOLESWORTH | TAS | 7140 | Derwent Valley | West Coast | 1 |
| HEXHAM | NSW | 2322 | Newcastle | Cessnock | 1 |
| DERBY | WA | 6728 | Derby-West Kimberley | Broome | 1 |
| SANDRINGHAM | NSW | 2219 | Bayside (NSW) | Georges River | 1 |
| BRIGHTON | TAS | 7030 | Brighton | Northern Midlands | 1 |
| OYSTER COVE | TAS | 7150 | Kingborough | Huon Valley | 1 |
| FORESTVILLE | SA | 5035 | Unley | West Torrens | 1 |
| GLENCOE | QLD | 4352 | Toowoomba | Goondiwindi | 1 |
| CAWDOR | QLD | 4352 | Toowoomba | Goondiwindi | 1 |
| BUNGAREE | VIC | 3352 | Moorabool | Corangamite | 1 |

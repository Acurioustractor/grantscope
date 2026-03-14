-- Backfill ABNs for Australian Commonwealth government bodies
-- Source: ABR (Australian Business Register) public lookup

-- Major departments and agencies
UPDATE gs_entities SET abn = '34190894983' WHERE canonical_name = 'Australian Taxation Office' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '68706814312' WHERE canonical_name = 'Department of Defence' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '61573993354' WHERE canonical_name = 'Department of Home Affairs' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '46640947264' WHERE canonical_name = 'Department of Education' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '52234063906' WHERE canonical_name = 'Department of Finance' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '24113085695' WHERE canonical_name = 'Department of Agriculture' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '77505890165' WHERE canonical_name = 'Attorney-General''s Department' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '47065634525' WHERE canonical_name = 'CSIRO' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '41687119230' WHERE canonical_name = 'Australian Federal Police' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '92661124436' WHERE canonical_name = 'Australian Bureau of Statistics' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '83605426759' WHERE canonical_name = 'Australian Electoral Commission' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '17520452660' WHERE canonical_name = 'Australian Securities and Investments Commission' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '50507852119' WHERE canonical_name = 'Australian Prudential Regulation Authority' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '63573050900' WHERE canonical_name = 'Australian Competition and Consumer Commission' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '25507093202' WHERE canonical_name = 'Australian Human Rights Commission' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '92661132043' WHERE canonical_name = 'Bureau of Meteorology' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '83135755188' WHERE canonical_name = 'Australian Research Council' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '72508615865' WHERE canonical_name = 'Australian Communications and Media Authority' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '24223925833' WHERE canonical_name = 'Austrade' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '83605426759' WHERE canonical_name = 'Australian National Audit Office' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '62573495744' WHERE canonical_name = 'Department of Infrastructure and Transport' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '68706814312' WHERE canonical_name = 'Australian War Memorial' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '44621900474' WHERE canonical_name = 'Australian Maritime Safety Authority' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '19499216498' WHERE canonical_name = 'Australian Institute of Marine Science' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '67115694781' WHERE canonical_name = 'Australian Institute of Health and Welfare' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '54601210642' WHERE canonical_name = 'Australian Digital Health Agency' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '62571020364' WHERE canonical_name = 'Clean Energy Regulator' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '40633702950' WHERE canonical_name = 'Comcare' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '41193802534' WHERE canonical_name = 'Cancer Australia' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '32110347354' WHERE canonical_name = 'Aged Care Quality and Safety Commission' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '38129506116' WHERE canonical_name = 'Australian Signals Directorate' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '14702058642' WHERE canonical_name = 'Australian Public Service Commission' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '67102931498' WHERE canonical_name = 'Australian Criminal Intelligence Commission' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '62573495744' WHERE canonical_name = 'Department of Infrastructure, Transport, Regional Development, Communications, Sport and the Arts' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');
UPDATE gs_entities SET abn = '17540720411' WHERE canonical_name = 'Department of Parliamentary Services' AND entity_type = 'government_body' AND (abn IS NULL OR abn = '');

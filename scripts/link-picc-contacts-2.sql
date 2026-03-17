-- Link NIAA
UPDATE org_contacts SET linked_entity_id = 'a4e675ff-9be9-4ec3-a6b3-187fcdf21c69'
WHERE name = 'NIAA' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- Link QFCC (Commissioner Natalie Lewis)
UPDATE org_contacts SET linked_entity_id = '99ac64dd-ee87-46dd-9c77-06e5640e14c3'
WHERE name LIKE '%QFCC%' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

-- Link QLD DCSSDS
UPDATE org_contacts SET linked_entity_id = 'c9bddf89-56a5-4e10-83f4-80987bbff308'
WHERE name = 'QLD DCSSDS' AND org_profile_id IN (SELECT id FROM org_profiles WHERE slug = 'picc');

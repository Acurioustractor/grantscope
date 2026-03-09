import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tables = [
  'grant_opportunities',
  'foundations', 
  'foundation_programs',
  'acnc_charities',
  'community_orgs',
  'social_enterprises',
  'oric_corporations',
  'austender_contracts',
  'political_donations',
  'gs_entities',
  'gs_relationships',
  'seifa_2021',
  'asic_companies'
];

console.log('Table | created_at | updated_at');
console.log('--- | --- | ---');

for (const table of tables) {
  try {
    // Try to query the table
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`${table} | ERROR: ${error.message.slice(0, 40)}`);
      continue;
    }
    
    if (!data || data.length === 0) {
      console.log(`${table} | NO DATA | NO DATA`);
      continue;
    }
    
    const row = data[0];
    const hasCreated = 'created_at' in row;
    const hasUpdated = 'updated_at' in row;
    console.log(`${table} | ${hasCreated ? '✓' : '❌'} | ${hasUpdated ? '✓' : '❌'}`);
  } catch (err) {
    console.log(`${table} | EXCEPTION | ${err.message.slice(0, 30)}`);
  }
}

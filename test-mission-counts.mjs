import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/benknight/Code/grantscope/.env' });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function safe(p, ms = 15000) {
  const fallback = { count: null, data: null, error: 'timeout' };
  return Promise.race([
    Promise.resolve(p),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const TABLES = [
  { key: 'gs_entities', label: 'Entities', table: 'gs_entities', category: 'entity', countMode: 'estimated', freshnessCol: 'updated_at' },
  { key: 'foundations', label: 'Foundations', table: 'foundations', category: 'funding', countMode: 'exact', freshnessCol: 'updated_at' },
  { key: 'acnc_charities', label: 'ACNC Charities', table: 'acnc_charities', category: 'registry', countMode: 'estimated', freshnessCol: 'updated_at' },
];

async function run() {
  const countPromises = TABLES.map(t =>
    safe(db.from(t.table).select('*', { count: t.countMode, head: true }))
  );
  const counts = await Promise.all(countPromises);
  TABLES.forEach((t, i) => {
    console.log(t.label, counts[i]);
  });
}
run();

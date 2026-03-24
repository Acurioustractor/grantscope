import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function buildProjectEmbeddingText(project) {
  return [
    project.name,
    project.description,
    project.domains?.length ? `Focus areas: ${project.domains.join(', ')}` : null,
    project.geographic ? `Geography: ${project.geographic}` : null,
    project.category ? `Category: ${project.category}` : null,
  ].filter(Boolean).join('\n').slice(0, 8000);
}

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  const { data: orgs, error } = await supabase
    .from('org_profiles')
    .select('id, name, projects')
    .not('projects', 'is', null);

  if (error) {
    console.error('Failed to fetch org profiles:', error.message);
    process.exit(1);
  }

  let total = 0;
  let created = 0;

  for (const org of orgs) {
    const projects = org.projects || [];
    if (!projects.length) continue;

    console.log(`\n${org.name}: ${projects.length} projects`);

    for (const project of projects) {
      total++;
      const embeddingText = buildProjectEmbeddingText(project);
      console.log(`  ${project.code} (${project.name}): ${embeddingText.length} chars`);

      let embedding;
      try {
        embedding = await embed(embeddingText);
      } catch (err) {
        console.error(`    ERROR generating embedding: ${err.message}`);
        continue;
      }

      const geoFocus = project.geographic
        ? project.geographic.split(',').map(g => g.trim()).filter(Boolean)
        : [];

      const { error: upsertError } = await supabase
        .from('project_profiles')
        .upsert({
          org_profile_id: org.id,
          project_code: project.code,
          name: project.name,
          description: project.description || null,
          domains: project.domains || [],
          geographic_focus: geoFocus,
          embedding: JSON.stringify(embedding),
          embedding_text: embeddingText,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_profile_id,project_code' });

      if (upsertError) {
        console.error(`    ERROR upserting: ${upsertError.message}`);
      } else {
        console.log(`    ✓ embedded`);
        created++;
      }
    }
  }

  console.log(`\nDone: ${created}/${total} project profiles embedded`);
}

main().catch(console.error);

import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { getServiceSupabase } from '@/lib/supabase';
import { embedQuery } from '@grantscope/engine';

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are GrantScope, an Australian grant discovery assistant. You help community organisations find relevant grants and foundations.

When responding:
- Always cite specific grant names, amounts, and deadlines
- Be direct, specific, and actionable
- Link to grants using [Grant Name](/grants/{id}) format
- Link to foundations using [Foundation Name](/foundations/{id}) format
- If no relevant grants are found, suggest broadening the search or adjusting criteria
- Focus on Australian funding sources
- When mentioning amounts, use Australian dollars

You have access to a database of government grants and philanthropic foundations across Australia.`;

interface GrantResult {
  id: string;
  name: string;
  provider: string;
  description: string;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[];
  similarity: number;
}

interface FoundationResult {
  id: string;
  name: string;
  type: string | null;
  total_giving_annual: number | null;
  thematic_focus: string[];
  description: string | null;
}

function formatMoney(n: number | null): string {
  if (!n) return 'Unknown';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

/** Extract text from a UIMessage (which uses parts array, not content string) */
function getTextFromMessage(msg: UIMessage): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: UIMessage[] };
  const supabase = getServiceSupabase();

  const lastMsg = messages[messages.length - 1];
  const lastMessage = lastMsg ? getTextFromMessage(lastMsg) : '';

  // RAG: embed the user query and search
  let contextText = '';

  try {
    if (process.env.OPENAI_API_KEY && lastMessage.length > 3) {
      const queryEmbedding = await embedQuery(lastMessage, process.env.OPENAI_API_KEY);

      // Search grants
      const { data: grants } = await supabase.rpc('search_grants_semantic', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.6,
        match_count: 10,
      });

      if (grants && grants.length > 0) {
        const grantResults = grants as GrantResult[];
        contextText += '\n\n## Relevant Grants\n';
        for (const g of grantResults) {
          const amount = g.amount_max ? formatMoney(g.amount_max) : 'Amount varies';
          const deadline = g.closes_at ? new Date(g.closes_at).toLocaleDateString('en-AU') : 'Ongoing';
          contextText += `- **${g.name}** (ID: ${g.id}) — ${g.provider}. ${amount}. Closes: ${deadline}. Match: ${Math.round(g.similarity * 100)}%`;
          if (g.categories?.length) contextText += `. Categories: ${g.categories.join(', ')}`;
          if (g.description) contextText += `. ${g.description.slice(0, 200)}`;
          contextText += '\n';
        }
      }

      // Search foundations by keyword
      const keywords = lastMessage.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3);
      if (keywords.length > 0) {
        const searchTerm = keywords.join(' ');
        const { data: foundations } = await supabase
          .from('foundations')
          .select('id, name, type, total_giving_annual, thematic_focus, description')
          .not('enriched_at', 'is', null)
          .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
          .order('total_giving_annual', { ascending: false, nullsFirst: false })
          .limit(5);

        if (foundations && foundations.length > 0) {
          const foundationResults = foundations as FoundationResult[];
          contextText += '\n\n## Relevant Foundations\n';
          for (const f of foundationResults) {
            contextText += `- **${f.name}** (ID: ${f.id}) — ${f.type || 'Foundation'}. Annual giving: ${formatMoney(f.total_giving_annual)}`;
            if (f.thematic_focus?.length) contextText += `. Focus: ${f.thematic_focus.join(', ')}`;
            if (f.description) contextText += `. ${f.description.slice(0, 150)}`;
            contextText += '\n';
          }
        }
      }
    }
  } catch (err) {
    console.error('[chat-rag]', err);
  }

  const systemPrompt = contextText
    ? `${SYSTEM_PROMPT}\n\nHere is relevant data from the GrantScope database for the user's query:${contextText}`
    : SYSTEM_PROMPT;

  // Convert UIMessages to model messages for streamText
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    messages: modelMessages,
  });

  return result.toTextStreamResponse();
}

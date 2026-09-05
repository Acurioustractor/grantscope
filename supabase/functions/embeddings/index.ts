// LinkedIn Embeddings Edge Function - Multi-Provider Support
// Generates embeddings using multiple AI providers with fallback logic
// Supports Anthropic Claude, OpenAI, and Perplexity APIs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types and interfaces
interface ProcessingResult {
  ok: boolean;
  processed: number;
  errors?: string[];
  processing_time_ms: number;
  provider_used?: string;
}

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
  usage?: {
    total_tokens: number;
  };
}

// Environment variables validation
const requiredEnvVars = {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  EDGE_ADMIN_TOKEN: Deno.env.get('EDGE_ADMIN_TOKEN')
};

// AI Provider configuration
const aiProviders = {
  HUGGINGFACE_API_KEY: Deno.env.get('HUGGINGFACE_API_KEY'),
  OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
  ANTHROPIC_API_KEY: Deno.env.get('ANTHROPIC_API_KEY'),
  PERPLEXITY_API_KEY: Deno.env.get('PERPLEXITY_API_KEY')
};

// Check for missing critical environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key, _]) => key);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars);
}

// Initialize Supabase client
const supabase = createClient(
  requiredEnvVars.SUPABASE_URL!,
  requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY!
);

// Authentication middleware
function authenticateRequest(request: Request): boolean {
  const adminToken = request.headers.get('X-Admin-Token');
  return adminToken === requiredEnvVars.EDGE_ADMIN_TOKEN;
}

// Multi-provider embedding generation with fallback
async function generateEmbedding(text: string): Promise<{embedding: number[], provider: string}> {
  const providers = [
    {
      name: 'HuggingFace',
      key: aiProviders.HUGGINGFACE_API_KEY,
      generate: () => generateHuggingFaceEmbedding(text)
    },
    {
      name: 'OpenAI',
      key: aiProviders.OPENAI_API_KEY,
      generate: () => generateOpenAIEmbedding(text)
    }
  ];

  // Try each provider in order
  for (const provider of providers) {
    if (!provider.key) {
      console.log(`${provider.name} API key not available, skipping`);
      continue;
    }

    try {
      console.log(`Attempting embedding generation with ${provider.name}`);
      const embedding = await provider.generate();
      return { embedding, provider: provider.name };
    } catch (error) {
      console.error(`${provider.name} embedding failed:`, error);
      continue;
    }
  }

  throw new Error('All embedding providers failed');
}

// Hugging Face embedding generation
async function generateHuggingFaceEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiProviders.HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: text,
      options: {
        wait_for_model: true
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
  }

  const embedding = await response.json();
  
  // Hugging Face returns the embedding directly as an array
  if (Array.isArray(embedding) && embedding.length > 0) {
    return embedding;
  }
  
  throw new Error('Invalid embedding response from Hugging Face');
}

// OpenAI embedding generation
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiProviders.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data: EmbeddingResponse = await response.json();
  return data.data[0].embedding;
}

// Anthropic embedding generation (using Claude for text processing then OpenAI for embedding)
async function generateAnthropicEmbedding(text: string): Promise<number[]> {
  // Note: Anthropic doesn't have direct embedding API, so we use it to optimize text then OpenAI for embedding
  // This is a fallback strategy when OpenAI primary fails
  
  try {
    // First, use Claude to optimize/summarize the text if it's too long
    const optimizedText = await optimizeTextWithClaude(text);
    
    // Then use OpenAI for the actual embedding (if available)
    if (aiProviders.OPENAI_API_KEY) {
      return await generateOpenAIEmbedding(optimizedText);
    } else {
      throw new Error('No embedding provider available after text optimization');
    }
  } catch (error) {
    throw new Error(`Anthropic-assisted embedding failed: ${error.message}`);
  }
}

// Optimize text using Claude (for long texts that might exceed token limits)
async function optimizeTextWithClaude(text: string): Promise<string> {
  if (text.length < 2000) {
    return text; // No optimization needed for short texts
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiProviders.ANTHROPIC_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Please create a concise professional summary of this LinkedIn profile that captures the key skills, experience, and value proposition for recruitment purposes. Keep it under 300 words:\n\n${text}`
      }]
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Rate limiting and retry logic with multi-provider support
async function generateEmbeddingWithRetry(
  text: string, 
  maxRetries: number = 3
): Promise<{embedding: number[], provider: string}> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      console.error(`Embedding generation attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Process contacts that need embeddings
async function processContacts(count: number): Promise<ProcessingResult> {
  const errors: string[] = [];
  let processed = 0;
  let providerUsed = '';

  try {
    const { data: contacts, error: queryError } = await supabase
      .from('v_contact_profile_text')
      .select('id, profile_text, profile_text_length')
      .eq('needs_embedding', true)
      .limit(count);

    if (queryError) {
      throw new Error(`Database query error: ${queryError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      return { ok: true, processed: 0, processing_time_ms: 0 };
    }

    console.log(`Processing ${contacts.length} contacts for embeddings`);

    for (const contact of contacts) {
      try {
        const result = await generateEmbeddingWithRetry(contact.profile_text);
        providerUsed = result.provider;
        
        const { error: updateError } = await supabase
          .from('linkedin_contacts')
          .update({ 
            profile_embedding: result.embedding,
            last_analyzed_at: new Date().toISOString()
          })
          .eq('id', contact.id);

        if (updateError) {
          errors.push(`Contact ${contact.id}: ${updateError.message}`);
          continue;
        }

        processed++;
        if (processed % 10 === 0) {
          console.log(`Processed ${processed}/${contacts.length} contacts using ${result.provider}`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        errors.push(`Contact ${contact.id}: ${error.message}`);
      }
    }

    return {
      ok: true,
      processed,
      errors: errors.length > 0 ? errors : undefined,
      processing_time_ms: 0,
      provider_used: providerUsed
    };
  } catch (error) {
    return {
      ok: false,
      processed,
      errors: [error.message],
      processing_time_ms: 0
    };
  }
}

// Process opportunities that need embeddings
async function processOpportunities(count: number): Promise<ProcessingResult> {
  const errors: string[] = [];
  let processed = 0;
  let providerUsed = '';

  try {
    const { data: opportunities, error: queryError } = await supabase
      .from('opportunities')
      .select('id, title, brief')
      .is('brief_embedding', null)
      .eq('status', 'active')
      .limit(count);

    if (queryError) {
      throw new Error(`Database query error: ${queryError.message}`);
    }

    if (!opportunities || opportunities.length === 0) {
      return { ok: true, processed: 0, processing_time_ms: 0 };
    }

    console.log(`Processing ${opportunities.length} opportunities for embeddings`);

    for (const opportunity of opportunities) {
      try {
        const text = `${opportunity.title}\n\n${opportunity.brief}`;
        const result = await generateEmbeddingWithRetry(text);
        providerUsed = result.provider;

        const { error: updateError } = await supabase
          .from('opportunities')
          .update({ 
            brief_embedding: result.embedding,
            updated_at: new Date().toISOString()
          })
          .eq('id', opportunity.id);

        if (updateError) {
          errors.push(`Opportunity ${opportunity.id}: ${updateError.message}`);
          continue;
        }

        processed++;
        if (processed % 10 === 0) {
          console.log(`Processed ${processed}/${opportunities.length} opportunities using ${result.provider}`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        errors.push(`Opportunity ${opportunity.id}: ${error.message}`);
      }
    }

    return {
      ok: true,
      processed,
      errors: errors.length > 0 ? errors : undefined,
      processing_time_ms: 0,
      provider_used: providerUsed
    };
  } catch (error) {
    return {
      ok: false,
      processed,
      errors: [error.message],
      processing_time_ms: 0
    };
  }
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
      },
    });
  }

  // Validate authentication
  if (!authenticateRequest(req)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing X-Admin-Token header' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Check environment variables
  if (missingVars.length > 0) {
    return new Response(
      JSON.stringify({ 
        error: 'Configuration Error', 
        message: 'Missing required environment variables',
        missing_vars: missingVars 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Check if at least one AI provider is available
  const availableProviders = Object.entries(aiProviders)
    .filter(([_, key]) => key)
    .map(([name, _]) => name);

  if (availableProviders.length === 0) {
    return new Response(
      JSON.stringify({ 
        error: 'Configuration Error', 
        message: 'No AI provider API keys configured' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');
    const count = parseInt(url.searchParams.get('count') || '100');

    // Validate parameters
    if (!mode || !['contacts', 'opportunity'].includes(mode)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Parameters', 
          message: 'Mode parameter must be "contacts" or "opportunity"' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (count <= 0 || count > 1000) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Parameters', 
          message: 'Count parameter must be between 1 and 1000' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const startTime = Date.now();
    let result: ProcessingResult;

    // Route to appropriate processing function
    if (mode === 'contacts') {
      result = await processContacts(count);
    } else {
      result = await processOpportunities(count);
    }

    result.processing_time_ms = Date.now() - startTime;

    // Add provider information to response
    const response = {
      ...result,
      available_providers: availableProviders,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error', 
        message: error.message,
        available_providers: availableProviders
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
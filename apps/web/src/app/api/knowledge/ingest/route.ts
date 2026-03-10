import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function getOrgProfileId(db: ReturnType<typeof getServiceSupabase>, userId: string) {
  const { data: own } = await db
    .from('org_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (own) return own.id;

  const { data: member } = await db
    .from('org_members')
    .select('org_profile_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return member?.org_profile_id || null;
}

function getSourceType(mimeType: string, filename: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('wordprocessingml')) return 'docx';
  if (filename.endsWith('.md')) return 'markdown';
  return 'text';
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceSupabase();
  const orgId = await getOrgProfileId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const url = formData.get('url') as string | null;

  if (!file && !url) {
    return NextResponse.json({ error: 'Provide a file or URL' }, { status: 400 });
  }

  let sourceName: string;
  let sourceType: string;
  let sourceUrl: string | null = null;
  let storagePath: string | null = null;

  if (file) {
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      return NextResponse.json({ error: 'Unsupported file type. Accepted: PDF, DOCX, MD, TXT' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    storagePath = `${orgId}/${timestamp}-${safeName}`;
    sourceName = file.name;
    sourceType = getSourceType(file.type, file.name);

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await db.storage
      .from('org-knowledge')
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }
  } else {
    // URL source
    sourceUrl = url!;
    sourceName = url!;
    sourceType = 'url';
  }

  // Create knowledge_sources record
  const knowledgeId = `org-${orgId}-${Date.now()}`;
  const { data: source, error: sourceError } = await db
    .from('knowledge_sources')
    .insert({
      knowledge_id: knowledgeId,
      source_type: sourceType,
      source_name: sourceName,
      source_url: sourceUrl,
      org_profile_id: orgId,
      storage_path: storagePath,
      authority_level: 1,
    })
    .select('id, source_name, source_type')
    .single();

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 });
  }

  // Queue for extraction
  const { error: queueError } = await db
    .from('knowledge_extraction_queue')
    .insert({
      source_type: sourceType,
      source_id: source.id,
      source_url: sourceUrl || storagePath,
      source_metadata: { org_profile_id: orgId, original_name: sourceName },
      raw_content: '', // Will be filled by processor
      status: 'pending',
      priority: 5,
    });

  if (queueError) {
    console.error('[knowledge-ingest] Queue error:', queueError);
  }

  return NextResponse.json({
    source_id: source.id,
    name: source.source_name,
    type: source.source_type,
    status: 'queued',
    message: 'Document queued for processing',
  }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceSupabase();
  const orgId = await getOrgProfileId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  // Fetch sources with queue status
  const { data: sources, error } = await db
    .from('knowledge_sources')
    .select('id, source_name, source_type, source_url, created_at, storage_path')
    .eq('org_profile_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get queue status and chunk counts for each source
  const sourceIds = (sources || []).map((s: { id: string }) => s.id);

  let queueStatuses: Record<string, string> = {};
  if (sourceIds.length > 0) {
    const { data: queue } = await db
      .from('knowledge_extraction_queue')
      .select('source_id, status')
      .in('source_id', sourceIds);
    if (queue) {
      for (const q of queue) {
        queueStatuses[q.source_id] = q.status;
      }
    }
  }

  // Get chunk counts
  let chunkCounts: Record<string, number> = {};
  if (sourceIds.length > 0) {
    const { data: chunks } = await db
      .from('knowledge_chunks')
      .select('source_id')
      .eq('org_profile_id', orgId);
    if (chunks) {
      for (const c of chunks) {
        if (c.source_id) {
          chunkCounts[c.source_id] = (chunkCounts[c.source_id] || 0) + 1;
        }
      }
    }
  }

  const enriched = (sources || []).map((s: { id: string; source_name: string; source_type: string; source_url: string | null; created_at: string; storage_path: string | null }) => ({
    ...s,
    status: queueStatuses[s.id] || 'unknown',
    chunk_count: chunkCounts[s.id] || 0,
  }));

  return NextResponse.json({ sources: enriched });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceSupabase();
  const orgId = await getOrgProfileId(db, user.id);
  if (!orgId) return NextResponse.json({ error: 'No org profile found' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const sourceId = searchParams.get('id');
  if (!sourceId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Get the source to check ownership and get storage path
  const { data: source } = await db
    .from('knowledge_sources')
    .select('id, storage_path')
    .eq('id', sourceId)
    .eq('org_profile_id', orgId)
    .single();

  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

  // Delete storage file if exists
  if (source.storage_path) {
    await db.storage.from('org-knowledge').remove([source.storage_path]);
  }

  // Delete associated chunks
  await db.from('knowledge_chunks').delete().eq('source_id', sourceId).eq('org_profile_id', orgId);

  // Delete queue entries
  await db.from('knowledge_extraction_queue').delete().eq('source_id', sourceId);

  // Delete the source
  await db.from('knowledge_sources').delete().eq('id', sourceId).eq('org_profile_id', orgId);

  return NextResponse.json({ deleted: true });
}

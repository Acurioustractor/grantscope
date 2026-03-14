import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * POST /api/procurement/upload
 *
 * CSV upload endpoint for supplier ledger analysis.
 * Accepts CSV with columns: supplier_name, abn, contract_value
 * Returns full compliance analysis with IPP/SME gap calculations.
 *
 * Body: multipart/form-data with 'file' field (CSV)
 *   OR JSON: { rows: Array<{ name?: string, abn: string, value?: number }> }
 *
 * Query params:
 *   ipp_target  — IPP target % (default: 3.0)
 *   sme_target  — SME target % (default: 30.0)
 *   total_spend — Total org procurement spend for gap calculation
 */
export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const ippTarget = parseFloat(request.nextUrl.searchParams.get('ipp_target') || '3.0') / 100;
  const smeTarget = parseFloat(request.nextUrl.searchParams.get('sme_target') || '30.0') / 100;
  const totalSpend = parseFloat(request.nextUrl.searchParams.get('total_spend') || '0');

  let rows: Array<{ name?: string; abn: string; value?: number }> = [];

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    const text = await file.text();
    rows = parseCSV(text);
  } else {
    const body = await request.json();
    rows = body.rows || [];
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid rows found. CSV must have an "abn" column.' }, { status: 400 });
  }

  if (rows.length > 2000) {
    return NextResponse.json({ error: 'Maximum 2000 suppliers per upload' }, { status: 400 });
  }

  const cleanAbns = [...new Set(rows.map(r => r.abn.replace(/\s/g, '')).filter(a => /^\d{11}$/.test(a)))];
  const valueMap: Record<string, number> = {};
  const nameMap: Record<string, string> = {};
  for (const r of rows) {
    const abn = r.abn.replace(/\s/g, '');
    if (r.value) valueMap[abn] = (valueMap[abn] || 0) + r.value;
    if (r.name) nameMap[abn] = r.name;
  }

  const supabase = getServiceSupabase();

  // Batch lookup — Supabase has 1000 row default, so chunk
  const allEntities: Array<Record<string, unknown>> = [];
  const allSocialEnterprises: Array<Record<string, unknown>> = [];

  for (let i = 0; i < cleanAbns.length; i += 500) {
    const chunk = cleanAbns.slice(i, i + 500);
    const [entRes, seRes] = await Promise.all([
      supabase.from('gs_entities')
        .select('abn, canonical_name, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, sector')
        .in('abn', chunk),
      supabase.from('social_enterprises')
        .select('abn, name, source_primary, certifications')
        .in('abn', chunk)
        .not('abn', 'is', null),
    ]);
    if (entRes.data) allEntities.push(...entRes.data);
    if (seRes.data) allSocialEnterprises.push(...seRes.data);
  }

  // Check for directorship data (black cladding risk)
  const directorshipResult = await supabase
    .from('gs_relationships')
    .select('source_entity_id, target_entity_id, relationship_type, dataset, year')
    .eq('relationship_type', 'directorship')
    .in('target_entity_id', allEntities.slice(0, 200).map((e: Record<string, unknown>) => e.abn).filter(Boolean));

  const entityMap = new Map(allEntities.map((e: Record<string, unknown>) => [e.abn as string, e]));
  const seMap = new Map(allSocialEnterprises.map((se: Record<string, unknown>) => [se.abn as string, se]));

  // Build enriched supplier profiles
  const suppliers = cleanAbns.map(abn => {
    const entity = entityMap.get(abn);
    const se = seMap.get(abn);
    const contractValue = valueMap[abn] || 0;
    const uploadedName = nameMap[abn];

    const isIndigenous = (entity?.entity_type === 'indigenous_corp') ||
      (se?.source_primary === 'supply-nation') ||
      (se?.source_primary === 'oric') ||
      (se?.source_primary === 'kinaway');
    const isSocialEnterprise = !!se;
    const isCommunityControlled = (entity?.is_community_controlled as boolean) || false;
    const isCharity = entity?.entity_type === 'charity';
    const isSME = entity?.entity_type !== 'company' || !entity; // conservative: unmatched are assumed non-SME

    return {
      abn,
      name: (entity?.canonical_name as string) || (se?.name as string) || uploadedName || null,
      uploaded_name: uploadedName || null,
      matched: !!(entity || se),
      contract_value: contractValue,
      is_indigenous: isIndigenous,
      is_social_enterprise: isSocialEnterprise,
      is_community_controlled: isCommunityControlled,
      is_charity: isCharity,
      entity_type: (entity?.entity_type as string) || null,
      state: (entity?.state as string) || null,
      postcode: (entity?.postcode as string) || null,
      remoteness: (entity?.remoteness as string) || null,
      seifa_irsd_decile: (entity?.seifa_irsd_decile as number) || null,
      lga: (entity?.lga_name as string) || null,
      certifications: (se?.certifications as Array<{ body: string }>) || null,
    };
  });

  // Compliance calculations
  const totalUploadedSpend = Object.values(valueMap).reduce((s, v) => s + v, 0);
  const effectiveSpend = totalSpend || totalUploadedSpend;

  const indigenousSuppliers = suppliers.filter(s => s.is_indigenous);
  const indigenousSpend = indigenousSuppliers.reduce((s, sup) => s + sup.contract_value, 0);
  const indigenousPct = effectiveSpend > 0 ? indigenousSpend / effectiveSpend : indigenousSuppliers.length / suppliers.length;

  const smeSuppliers = suppliers.filter(s => s.is_charity || s.is_social_enterprise || s.is_community_controlled);
  const smeSpend = smeSuppliers.reduce((s, sup) => s + sup.contract_value, 0);
  const smePct = effectiveSpend > 0 ? smeSpend / effectiveSpend : smeSuppliers.length / suppliers.length;

  const ippGap = Math.max(0, ippTarget - indigenousPct);
  const smeGap = Math.max(0, smeTarget - smePct);
  const ippGapDollars = effectiveSpend > 0 ? ippGap * effectiveSpend : 0;
  const smeGapDollars = effectiveSpend > 0 ? smeGap * effectiveSpend : 0;

  // Gap recommendations — find entities that could fill gaps
  let recommendations: Array<Record<string, unknown>> = [];
  if (ippGap > 0 || smeGap > 0) {
    // Find top Indigenous/SE suppliers NOT already in their list, by state coverage
    const existingStates = [...new Set(suppliers.filter(s => s.state).map(s => s.state))];
    const recResult = await supabase
      .from('gs_entities')
      .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, is_community_controlled, lga_name')
      .in('entity_type', ['indigenous_corp', 'social_enterprise'])
      .not('abn', 'in', `(${cleanAbns.slice(0, 100).join(',')})`)
      .in('state', existingStates.length > 0 ? existingStates as string[] : ['NSW', 'VIC', 'QLD'])
      .limit(20);

    recommendations = recResult.data || [];
  }

  // By-state and by-remoteness breakdowns
  const byState: Record<string, { count: number; value: number; indigenous: number; sme: number }> = {};
  const byRemoteness: Record<string, { count: number; value: number }> = {};
  const byLga: Record<string, { count: number; value: number; indigenous: number }> = {};

  for (const s of suppliers.filter(sup => sup.matched)) {
    const st = s.state || 'Unknown';
    if (!byState[st]) byState[st] = { count: 0, value: 0, indigenous: 0, sme: 0 };
    byState[st].count++;
    byState[st].value += s.contract_value;
    if (s.is_indigenous) byState[st].indigenous++;
    if (s.is_social_enterprise || s.is_charity) byState[st].sme++;

    const r = s.remoteness || 'Unknown';
    if (!byRemoteness[r]) byRemoteness[r] = { count: 0, value: 0 };
    byRemoteness[r].count++;
    byRemoteness[r].value += s.contract_value;

    const lga = s.lga || 'Unknown';
    if (!byLga[lga]) byLga[lga] = { count: 0, value: 0, indigenous: 0 };
    byLga[lga].count++;
    byLga[lga].value += s.contract_value;
    if (s.is_indigenous) byLga[lga].indigenous++;
  }

  // Disadvantage breakdown
  const byDisadvantage = {
    most_disadvantaged: { count: 0, value: 0, label: 'SEIFA Decile 1-2 (Most Disadvantaged)' },
    disadvantaged: { count: 0, value: 0, label: 'SEIFA Decile 3-4' },
    middle: { count: 0, value: 0, label: 'SEIFA Decile 5-6' },
    advantaged: { count: 0, value: 0, label: 'SEIFA Decile 7-8' },
    most_advantaged: { count: 0, value: 0, label: 'SEIFA Decile 9-10 (Most Advantaged)' },
    unknown: { count: 0, value: 0, label: 'Unknown' },
  };

  for (const s of suppliers.filter(sup => sup.matched)) {
    const d = s.seifa_irsd_decile;
    const v = s.contract_value;
    if (!d) { byDisadvantage.unknown.count++; byDisadvantage.unknown.value += v; }
    else if (d <= 2) { byDisadvantage.most_disadvantaged.count++; byDisadvantage.most_disadvantaged.value += v; }
    else if (d <= 4) { byDisadvantage.disadvantaged.count++; byDisadvantage.disadvantaged.value += v; }
    else if (d <= 6) { byDisadvantage.middle.count++; byDisadvantage.middle.value += v; }
    else if (d <= 8) { byDisadvantage.advantaged.count++; byDisadvantage.advantaged.value += v; }
    else { byDisadvantage.most_advantaged.count++; byDisadvantage.most_advantaged.value += v; }
  }

  return NextResponse.json({
    compliance: {
      ipp: {
        current: indigenousPct,
        target: ippTarget,
        gap: ippGap,
        gap_dollars: ippGapDollars,
        status: indigenousPct >= ippTarget ? 'compliant' : 'non_compliant',
        indigenous_suppliers: indigenousSuppliers.length,
        indigenous_spend: indigenousSpend,
      },
      sme: {
        current: smePct,
        target: smeTarget,
        gap: smeGap,
        gap_dollars: smeGapDollars,
        status: smePct >= smeTarget ? 'compliant' : 'non_compliant',
        sme_suppliers: smeSuppliers.length,
        sme_spend: smeSpend,
      },
      total_spend: effectiveSpend,
      match_rate: suppliers.filter(s => s.matched).length / suppliers.length,
    },
    suppliers,
    breakdowns: {
      by_state: byState,
      by_remoteness: byRemoteness,
      by_lga: byLga,
      by_disadvantage: byDisadvantage,
    },
    recommendations: recommendations.map(r => ({
      gs_id: r.gs_id,
      name: r.canonical_name,
      abn: r.abn,
      entity_type: r.entity_type,
      state: r.state,
      postcode: r.postcode,
      remoteness: r.remoteness,
      is_community_controlled: r.is_community_controlled,
      lga: r.lga_name,
    })),
    meta: {
      suppliers_uploaded: rows.length,
      unique_abns: cleanAbns.length,
      generated_at: new Date().toISOString(),
      targets: { ipp: ippTarget, sme: smeTarget },
    },
  });
}

function parseCSV(text: string): Array<{ name?: string; abn: string; value?: number }> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return [];

  // Detect delimiter
  const header = lines[0];
  const delimiter = header.includes('\t') ? '\t' : ',';
  const headers = header.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Find column indices
  const abnIdx = headers.findIndex(h => h === 'abn' || h === 'supplier_abn' || h === 'vendor_abn');
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'supplier_name' || h === 'vendor_name' || h === 'supplier');
  const valueIdx = headers.findIndex(h =>
    h === 'value' || h === 'contract_value' || h === 'amount' || h === 'spend' || h === 'total_value'
  );

  if (abnIdx === -1) {
    // Try to detect ABN column by content
    return [];
  }

  const rows: Array<{ name?: string; abn: string; value?: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], delimiter);
    const abn = (cols[abnIdx] || '').replace(/[^\d]/g, '');
    if (abn.length !== 11) continue;

    const row: { name?: string; abn: string; value?: number } = { abn };
    if (nameIdx >= 0 && cols[nameIdx]) row.name = cols[nameIdx];
    if (valueIdx >= 0 && cols[valueIdx]) {
      const val = parseFloat(cols[valueIdx].replace(/[$,]/g, ''));
      if (!isNaN(val)) row.value = val;
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

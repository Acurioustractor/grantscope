import {
  PERSON_CATEGORY_COLORS,
  PERSON_CATEGORY_LABELS,
  type OrgPeopleData,
  type PersonCategory,
} from '@/lib/services/org-people-service';

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

function daysAgo(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function PeopleSection({ people: data }: { people: OrgPeopleData | null }) {
  if (!data || data.totals.person_count === 0) return null;

  const { people, totals } = data;
  const family = people.filter((p) => p.person_category === 'family');
  const topContractors = people
    .filter((p) => p.person_category === 'contractor' && p.paid_total > 0)
    .slice(0, 12);
  const recentContacts = people
    .filter((p) => p.last_contact_date && (p.person_category === 'contact' || p.person_category === 'network'))
    .sort((a, b) => (b.last_contact_date ?? '').localeCompare(a.last_contact_date ?? ''))
    .slice(0, 10);
  const storytellers = people.filter((p) => p.is_storyteller).slice(0, 8);

  return (
    <section id="people-network" className="scroll-mt-24">
      <div className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-canvas px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
            People Network
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-wider text-bauhaus-black">
            Who's around ACT
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-bauhaus-muted">
            From <span className="font-mono">gs_entities</span> (family), <span className="font-mono">xero_invoices</span> ACCPAY (contractors), <span className="font-mono">ghl_contacts</span> tagged ACT/justicehub/goods/harvest/empathy.
          </p>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border-b-4 border-bauhaus-black">
          {([
            ['Total', totals.person_count, `${totals.storyteller_count} storyteller${totals.storyteller_count === 1 ? '' : 's'} · ${totals.elder_count} elder${totals.elder_count === 1 ? '' : 's'}`],
            ['Family', totals.family_count, 'Marchesi (gs_entities)'],
            ['Contractors', totals.contractor_count, 'Xero payees'],
            ['Network', totals.network_count, 'GHL contacts'],
            ['Total paid', fmtMoney(totals.total_paid_to_people), 'to people / contractors'],
          ] as const).map(([label, value, sub], i) => (
            <div
              key={label}
              className={`px-4 py-3 ${i < 4 ? 'border-r-4 border-bauhaus-black' : ''}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
              <div className="text-2xl font-black tabular-nums text-bauhaus-black">{value}</div>
              <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Family / founders */}
        {family.length > 0 && (
          <div className="border-b-4 border-bauhaus-black px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-3">
              Family / founders ({family.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {family.map((p) => (
                <div
                  key={p.person_name}
                  className="border-2 border-bauhaus-black bg-bauhaus-red/5 px-3 py-2"
                >
                  <div className="text-sm font-black text-bauhaus-black">{p.person_name}</div>
                  <div className="text-[10px] font-mono text-bauhaus-muted mt-0.5">
                    {p.sources}{p.gs_id && ` · ${p.gs_id}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top contractors */}
        {topContractors.length > 0 && (
          <div className="border-b-4 border-bauhaus-black px-5 py-4">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Top contractors / suppliers (paid)
              </div>
              <div className="text-[10px] font-mono text-bauhaus-muted">
                showing {topContractors.length} of {totals.contractor_count}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                    <th className="text-left py-1 pr-2">Name</th>
                    <th className="text-right py-1 px-2">Paid</th>
                    <th className="text-right py-1 px-2">Bills</th>
                    <th className="text-left py-1 px-2">Projects</th>
                    <th className="text-right py-1 pl-2">Last paid</th>
                  </tr>
                </thead>
                <tbody>
                  {topContractors.map((p) => (
                    <tr key={p.person_name} className="border-b border-bauhaus-black/10">
                      <td className="py-1.5 pr-2 font-black text-bauhaus-black">{p.person_name}</td>
                      <td className="text-right py-1.5 px-2 font-mono tabular-nums font-black">{fmtMoney(p.paid_total)}</td>
                      <td className="text-right py-1.5 px-2 font-mono text-[10px] text-bauhaus-muted tabular-nums">{p.paid_invoice_count}</td>
                      <td className="py-1.5 px-2 font-mono text-[10px] text-bauhaus-muted">{(p.xero_project_codes ?? []).join(', ') || '—'}</td>
                      <td className="text-right py-1.5 pl-2 text-[10px] font-mono text-bauhaus-muted">{fmtDate(p.last_paid_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent network contacts */}
        {recentContacts.length > 0 && (
          <div className="border-b-4 border-bauhaus-black px-5 py-4">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                Recent network activity (GHL)
              </div>
              <div className="text-[10px] font-mono text-bauhaus-muted">most-recent contact first</div>
            </div>
            <div className="space-y-1.5">
              {recentContacts.map((p) => (
                <div key={p.person_name} className="flex items-baseline gap-3 text-xs border-b border-bauhaus-black/10 pb-1">
                  <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${PERSON_CATEGORY_COLORS[p.person_category as PersonCategory]}`}>
                    {PERSON_CATEGORY_LABELS[p.person_category as PersonCategory]}
                  </span>
                  <span className="font-black text-bauhaus-black truncate">{p.person_name}</span>
                  {p.company_name && <span className="text-[10px] font-mono text-bauhaus-muted truncate">{p.company_name}</span>}
                  {p.is_storyteller && <span className="px-1 py-0.5 text-[8px] font-black uppercase tracking-wider bg-purple-600 text-white">STORY</span>}
                  {p.is_elder && <span className="px-1 py-0.5 text-[8px] font-black uppercase tracking-wider bg-bauhaus-red text-white">ELDER</span>}
                  <span className="ml-auto text-[10px] font-mono text-bauhaus-muted">{daysAgo(p.last_contact_date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Storytellers */}
        {storytellers.length > 0 && (
          <div className="px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-3">
              Storytellers ({totals.storyteller_count})
            </div>
            <div className="flex flex-wrap gap-1">
              {storytellers.map((p) => (
                <span
                  key={p.person_name}
                  className="px-2 py-1 text-xs font-black uppercase tracking-wider bg-purple-600 text-white"
                  title={p.email ?? ''}
                >
                  {p.person_name}
                </span>
              ))}
              {totals.storyteller_count > storytellers.length && (
                <span className="px-2 py-1 text-xs font-mono text-bauhaus-muted">
                  + {totals.storyteller_count - storytellers.length} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

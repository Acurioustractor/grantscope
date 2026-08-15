import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDirectServiceSupabase } from '@/lib/supabase';
import {
  blockingSentinels,
  coverageText,
  isRefusedCard,
  stampLabel,
  type BoardCard,
  type Ingredient,
} from '../../board-types';
import CopyClaim from './CopyClaim';
import {
  effortLabel,
  formatMetric,
  movementLabel,
  targetLabel,
  type WantRow,
} from '../../wants/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Clarity · ${slug}` };
}

/**
 * ONE query. The ingredients travel on the card (view column, binding first), because two
 * sequential PostgREST calls meant the second could lose its connection under pool pressure and
 * 500 the whole page — which is exactly what happened on 15 Aug.
 */
async function load(
  slug: string,
): Promise<{ card: BoardCard; ingredients: Ingredient[]; want: WantRow | null } | null> {
  const supabase = getDirectServiceSupabase();

  const { data: cards, error } = await supabase
    .from('v_clarity_board_cards')
    .select('*')
    .eq('slug', slug)
    .limit(1);
  if (error) throw new Error(`board query failed: ${error.message}`);
  if (!cards?.length) return null;

  const card = cards[0] as unknown as BoardCard;

  // Contextual want rendering (G15): a want appears on every question it blocks, not only on the
  // want list. This is a second round trip, so it degrades to null rather than taking the page
  // down with it — the answer above is what the reader came for.
  let want: WantRow | null = null;
  try {
    const { data } = await supabase.from('v_clarity_wants').select('*').eq('slug', slug).limit(1);
    want = (data?.[0] as unknown as WantRow) ?? null;
  } catch {
    want = null;
  }

  return { card, ingredients: card.ingredients ?? [], want };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-4 border-bauhaus-black bg-bauhaus-white">
      <h2 className="border-b-2 border-bauhaus-black px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function WorkedAnswerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = await load(slug);
  if (!loaded) notFound();

  const { card, ingredients, want } = loaded;
  const blocked = blockingSentinels(card);
  const isRefused = isRefusedCard(card);
  // UNVERIFIED and PILOT are stamps, not footnotes. A number carrying either one travels with it.
  const stamp = stampLabel(card);
  const coverage = coverageText(card);
  const flags = Object.entries(card.sentinel_flags ?? {});

  return (
    <main className="min-h-screen bg-bauhaus-canvas px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="border-4 border-bauhaus-black bg-bauhaus-white p-6">
          <Link
            href="/clarity"
            className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
          >
            ◀ Clarity
          </Link>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-widest text-bauhaus-black">
            {card.stub}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-bauhaus-black">{card.question}</p>

          {stamp ? (
            <p className="mt-3 inline-block border-4 border-bauhaus-red px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-bauhaus-red">
              {stamp} — {stamp === 'PILOT'
                ? 'a worked example, not a corpus. Do not quote it as coverage.'
                : 'nobody has reproduced this number against its source.'}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {isRefused ? (
              /* No claim to copy. A refusal offering a clipboard button is offering the reader a
                 sentence to paste somewhere it will be read as a finding. */
              <span className="border-2 border-bauhaus-red bg-bauhaus-red px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-canvas">
                Refused · no claim to copy
              </span>
            ) : (
            <CopyClaim
              claim={card.claim_phrasing}
              headline={blocked.length ? null : card.headline}
              headlineSub={blocked.length ? null : card.headline_sub}
              caveat={card.caveat}
              exclusions={card.exclusions}
              coverage={coverage}
              computedAt={card.computed_at}
              url={`/clarity/q/${card.slug}`}
            />
            )}
            {!isRefused && card.row_count != null && (
              <Link
                href={`/clarity/q/${card.slug}/rows`}
                className="border-2 border-bauhaus-black bg-bauhaus-white px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-yellow"
              >
                See the {card.row_count.toLocaleString()} rows →
              </Link>
            )}
            <span className="font-mono text-[10px] uppercase tracking-widest text-bauhaus-muted">
              {card.computed_at
                ? `computed ${card.computed_at.slice(0, 16).replace('T', ' ')} UTC`
                : 'never run'}
              {card.duration_ms != null && ` · ${card.duration_ms} ms`}
              {` · run #${card.run_count}`}
            </span>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {isRefused ? (
              /*
               * THE REFUSED FORM. No chart, no number, no struck-through headline — a refusal that
               * renders a greyed-out version of the thing it is refusing to draw is still drawing
               * it. This is the only place in either repo where a refusal has its own URL, and the
               * page continues the journey rather than dead-ending: what we can honestly show sits
               * directly under why we will not show this.
               */
              <section className="border-4 border-bauhaus-red bg-bauhaus-white">
                <h2 className="border-b-2 border-bauhaus-red bg-bauhaus-red px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-canvas">
                  This view refuses to render
                </h2>
                <div className="space-y-4 p-5">
                  <p className="max-w-[70ch] text-sm leading-relaxed text-bauhaus-black">
                    {card.refuses_when}
                  </p>
                  <div>
                    <h3 className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-black">
                      What we can honestly show instead
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-sm text-bauhaus-black">
                      <li>
                        ▸ {card.honest_at} ÷ {card.honest_at === 'state' ? 'LGA' : 'finer'} framing,
                        labelled as such — {card.claim_phrasing}
                      </li>
                      <li>
                        ▸{' '}
                        <Link
                          href="/clarity/q/watchhouse-children"
                          className="font-black underline hover:text-bauhaus-blue"
                        >
                          WATCHHOUSE CHILDREN
                        </Link>{' '}
                        — facility-level, near-daily, roughly one day lagged. Police custody, not
                        detention. Not comparable to AIHW figures without saying so.
                      </li>
                    </ul>
                  </div>
                  <p className="border-t-2 border-bauhaus-muted pt-3 text-xs leading-relaxed text-bauhaus-black">
                    {card.caveat}
                  </p>
                </div>
              </section>
            ) : (
            <Panel title="The answer">
              {card.ok === false ? (
                <div className="border-2 border-bauhaus-red p-3">
                  <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
                    Last run failed
                  </p>
                  <p className="mt-1 font-mono text-xs text-bauhaus-black">{card.error_text}</p>
                </div>
              ) : blocked.length ? (
                <div>
                  <p className="font-mono text-5xl font-black text-bauhaus-black line-through">
                    {card.headline}
                  </p>
                  <p className="mt-2 font-mono text-xs font-black uppercase tracking-widest text-bauhaus-red">
                    Not shown — {blocked.join(', ')}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-mono text-5xl font-black text-bauhaus-black">{card.headline}</p>
                  <p className="mt-2 text-sm text-bauhaus-black">{card.headline_sub}</p>
                </div>
              )}

              {coverage && (
                <p className="mt-4 border-t-2 border-bauhaus-muted pt-3 font-mono text-[11px] text-bauhaus-black">
                  {coverage}
                  <span className="text-bauhaus-muted"> · {card.coverage_label}</span>
                </p>
              )}
            </Panel>
            )}

            {want ? (
              <Panel title="What would make this answerable">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <b className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
                    {effortLabel(want)}
                  </b>
                  {want.metric_now !== null ? (
                    <span className="font-mono text-xs text-bauhaus-black">
                      now {formatMetric(want.metric_now, want.metric_unit)} · {targetLabel(want)}
                    </span>
                  ) : null}
                  <span className="font-mono text-[11px] text-bauhaus-muted">
                    {movementLabel(want)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-bauhaus-black">
                  {want.unlock_note ??
                    'Nobody has written down what closing this would take. Until somebody does, it ranks last on the want list and says so.'}
                </p>
                {want.blocker_objects.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] text-bauhaus-muted">
                    blocked by {want.blocker_objects.map((b) => b.object_name).join(', ')}
                  </p>
                )}
                {want.also_blocks > 0 && (
                  <p className="mt-2 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-black">
                    Also stalls {want.also_blocks} other question
                    {want.also_blocks === 1 ? '' : 's'}
                  </p>
                )}
                <Link
                  href="/clarity/wants"
                  className="mt-4 inline-block border-2 border-bauhaus-black bg-bauhaus-white px-3 py-1.5 font-mono text-[11px] font-black uppercase tracking-widest hover:bg-bauhaus-yellow"
                >
                  The want list →
                </Link>
              </Panel>
            ) : null}

            <Panel title="Say it this way">
              {card.claim_phrasing?.trim() ? (
                <p className="border-l-4 border-bauhaus-blue pl-3 text-sm text-bauhaus-black">
                  {card.claim_phrasing}
                </p>
              ) : (
                /* Internal questions — the HOUSE subject — carry no publishable phrasing on
                   purpose. Rendering an empty quote block would read as a missing value. */
                <p className="border-l-4 border-bauhaus-muted pl-3 text-sm text-bauhaus-muted">
                  Nothing to quote. This is a question about ourselves, measured against this
                  database, and it is not a claim about the world.
                </p>
              )}
              {card.forbidden_phrasing?.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {card.forbidden_phrasing.map((f) => (
                    <li key={f} className="font-mono text-[11px] text-bauhaus-red">
                      NOT: &ldquo;{f}&rdquo;
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 border-t-2 border-bauhaus-muted pt-3 text-xs leading-relaxed text-bauhaus-black">
                {card.caveat}
              </p>
            </Panel>

            <Panel title="Exclusions — deterministic, not a sample">
              <p className="font-mono text-xs leading-relaxed text-bauhaus-black">
                {card.exclusions}
              </p>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Provenance">
              <ul className="space-y-3">
                {ingredients.map((i) => (
                    <li key={`${i.object_key}|${i.join_key}`} className="border-b-2 border-bauhaus-muted pb-2 last:border-0">
                      <p className="font-mono text-xs font-black text-bauhaus-black">
                        {i.object_key.replace(/^public\./, '')}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-bauhaus-muted">
                        {i.role}
                        {i.join_key && ` · ${i.join_key}`}
                        {i.measured_pct != null && ` · ${Number(i.measured_pct).toFixed(2)}%`}
                      </p>
                      {i.is_binding && (
                        <p className="mt-1 font-mono text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                          ◀ binding join — caps this claim
                        </p>
                      )}
                    </li>
                  ))}
              </ul>
            </Panel>

            <Panel title="Sentinels">
              {flags.length === 0 ? (
                <p className="font-mono text-[11px] text-bauhaus-muted">None recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {flags.map(([key, f]) => (
                    <li key={key} className="font-mono text-[11px]">
                      <span
                        className={
                          f.tripped && f.blocking
                            ? 'text-bauhaus-red'
                            : f.tripped
                              ? 'text-bauhaus-black'
                              : 'text-bauhaus-muted'
                        }
                      >
                        {f.tripped ? (f.blocking ? '✕' : '•') : '✓'} {key}
                      </span>
                      {/* A tripped-but-not-blocking sentinel is stated plainly rather than hidden:
                          the contamination is real, it just is not in this question's path. */}
                      {f.tripped && !f.blocking && !f.exempt_reason && (
                        <span className="text-bauhaus-muted"> — tripped, not in this question&rsquo;s path</span>
                      )}
                      {/* An exemption is a decision somebody made in writing, so it is shown in
                          full rather than as the word "exempt". A reader who disagrees with the
                          reasoning can see the reasoning. */}
                      {f.tripped && f.exempt_reason && (
                        <>
                          <span className="text-bauhaus-blue"> — exempted from this question</span>
                          <span className="mt-1 block max-w-[46ch] font-sans text-[11px] leading-snug text-bauhaus-muted">
                            {f.exempt_reason}
                          </span>
                        </>
                      )}
                      {f.n != null && <span className="text-bauhaus-muted"> · n={f.n.toLocaleString()}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Why nowhere else">
              <p className="text-xs leading-relaxed text-bauhaus-black">
                {card.uniqueness_basis ?? 'Not stated.'}
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-bauhaus-muted">
                uniqueness {Number(card.uniqueness).toFixed(2)} · hand-set, declared curation debt
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}

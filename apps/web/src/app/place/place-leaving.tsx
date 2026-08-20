import { money } from '@/lib/format';
import type { LeavingProgram } from '@/lib/grant-place-capture';

/**
 * Programs that already run in this place and are already won by someone else.
 *
 * The only list on this surface a community organisation can act on. Everything else here says
 * what is true; this says what is available.
 *
 * THE ORDERING IS BY MONEY AND THE READING IS BY REPETITION, and those point at different rows.
 * Measured on Ashburton 2026-08-21, the top two are `Activating a Regional Hydrogen Industry`
 * ($3.3m, Engie) and `Domestic Airports Security Costs Support` ($990k, Hamersley Iron) — programs
 * no community organisation could deliver. The actionable one is fourth and small: `Community
 * Child Care Fund`, three awards, one recipient in Belmont. So the counts ride with every row and
 * the note below says outright that size is not opportunity. Sorting by size alone and calling it
 * a list of missed chances would be the same mistake as showing a dollar share on its own.
 */
export function PlaceLeaving({
  programs,
  lgaName,
}: {
  programs: LeavingProgram[];
  lgaName: string;
}) {
  if (programs.length === 0) return null;

  return (
    <section className="border-4 border-bauhaus-black bg-white p-6 lg:p-8">
      <h2 className="font-black uppercase tracking-widest text-bauhaus-black">
        Programs running here, won elsewhere
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed">
        Federal grant programs whose money was delivered into {lgaName} and received by an
        organisation based somewhere else.
      </p>

      <ul className="mt-6 divide-y-2 divide-bauhaus-black/10 border-y-4 border-bauhaus-black">
        {programs.map(p => (
          <li key={p.program} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
            <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{p.program}</span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
              {p.awards === 1 ? '1 award' : `${p.awards} awards`}
              {p.recipients > 1 ? ` · ${p.recipients} recipients` : ''}
              {p.latestYear ? ` · latest ${p.latestYear}` : ''}
            </span>
            <span className="font-mono text-sm font-black tabular-nums">{money(p.dollars)}</span>
          </li>
        ))}
      </ul>

      {/* Said outright rather than left to be inferred from the row values. */}
      <p className="mt-5 max-w-2xl border-l-4 border-bauhaus-blue pl-4 text-sm leading-relaxed">
        <strong>Size is not opportunity.</strong> The largest rows here are usually infrastructure,
        energy or resources programs that no community organisation could deliver. The ones worth
        a second look are the <strong>repeated</strong> ones — a program appearing several times,
        going to the same organisation each time, is work that keeps coming back to this place and
        keeps leaving it.
      </p>

      <p className="mt-4 max-w-2xl font-mono text-[11px] leading-relaxed uppercase tracking-widest text-bauhaus-black/60">
        Program names are reproduced as the Commonwealth published them, typographical errors
        included. A program missing from this list was not necessarily won locally — it may simply
        be one where we cannot resolve where the recipient is based.
      </p>
    </section>
  );
}

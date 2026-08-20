import Link from 'next/link';
import { money } from '@/lib/format';
import type { PlacePhilanthropy } from '@/lib/place-philanthropy';

/**
 * Which foundations and family trusts fund organisations here.
 *
 * The only lane on this page that is not government money, and the one whose absence is most
 * likely to be misread. We hold grantee lists for 24 foundations out of 11,177, and two of them
 * — FRRR and the Ian Potter Foundation — are 98% of everything reaching remote councils.
 *
 * So a short list here is a fact about which funders publish, not about which funders give. The
 * caveat is not a footnote: without it this section reads as "the philanthropic sector has not
 * come here", which we have no evidence for and which would be an accusation.
 */
export function PlacePhilanthropySection({
  philanthropy,
  lgaName,
}: {
  philanthropy: PlacePhilanthropy | null;
  lgaName: string;
}) {
  if (!philanthropy) {
    return (
      <section className="border-4 border-bauhaus-black bg-white p-6 lg:p-8">
        <h2 className="font-black uppercase tracking-widest text-bauhaus-black">
          Philanthropy we can see
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed">
          None recorded for {lgaName}. <strong>That is almost certainly our gap, not the
          sector&apos;s.</strong> We hold published grantee lists for 24 foundations; there are
          11,177 on the register. Most foundations do not publish who they fund, and family trusts
          almost never do.
        </p>
      </section>
    );
  }

  const { grants, foundations, totalKnown } = philanthropy;

  return (
    <section className="border-4 border-bauhaus-black bg-white p-6 lg:p-8">
      <h2 className="font-black uppercase tracking-widest text-bauhaus-black">
        Philanthropy we can see
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed">
        {grants.length} grant{grants.length === 1 ? '' : 's'} from {foundations} foundation
        {foundations === 1 ? '' : 's'} to organisations in {lgaName}
        {totalKnown > 0 ? `, ${money(totalKnown)} where an amount was published` : ''}.
      </p>

      <ul className="mt-6 divide-y-2 divide-bauhaus-black/10 border-y-4 border-bauhaus-black">
        {grants.map((g, i) => (
          <li
            key={`${g.foundation}-${g.grantee}-${g.year}-${i}`}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold leading-snug">{g.foundation}</span>
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-widest text-bauhaus-black/55">
                to{' '}
                {g.granteeGsId ? (
                  <Link
                    href={`/entity/${g.granteeGsId}`}
                    className="underline decoration-1 underline-offset-2 hover:text-bauhaus-blue"
                  >
                    {g.grantee}
                  </Link>
                ) : (
                  g.grantee
                )}
                {g.year ? ` · ${g.year}` : ''}
              </span>
            </span>
            <span className="font-mono text-sm font-black tabular-nums">
              {g.amount !== null ? (
                money(g.amount)
              ) : (
                <span className="font-normal text-[11px] uppercase tracking-widest text-bauhaus-black/55">
                  {g.amountNotPublished ? 'amount not published' : 'amount not held'}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 max-w-2xl border-l-4 border-bauhaus-blue pl-4 text-sm leading-relaxed">
        <strong>This is who publishes, not who gives.</strong> We hold grantee lists for 24
        foundations out of 11,177 on the register, and across remote Australia two of them — the
        Foundation for Rural and Regional Renewal and the Ian Potter Foundation — account for 98% of
        every grant we can see. A foundation missing from this list has not been shown to be absent
        from this place.
      </p>
    </section>
  );
}

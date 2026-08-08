import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { getPostcodeFundingPicture } from '@/lib/services/place-intelligence';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Where the money goes: the Far West Coast — CivicGraph',
  description:
    'Public money reaching organisations on the Far West Coast of South Australia: Ceduna, Koonibba, Scotdesco, Yalata and Oak Valley.',
};

function money(value: number): string {
  if (!value) return '$0';
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString('en-AU', { maximumFractionDigits: 1 })}M`;
  }
  return `$${Math.round(value).toLocaleString('en-AU')}`;
}

/**
 * The five communities, and who holds the paperwork for each.
 *
 * This column exists because the data kept trying to hide it. Yalata Anangu
 * Aboriginal Corporation's registered office is in Ceduna. So is Oak Valley's.
 * Every automated way of placing an organisation - postcode, registered
 * address, postal locality - therefore files their money under Ceduna. The
 * communities are 200km and 700km away.
 */
const COMMUNITIES = [
  { name: 'Ceduna', council: 'District Council of Ceduna', note: 'The regional centre. Most services for the coast are run from here.' },
  { name: 'Koonibba', council: 'District Council of Ceduna', note: 'About 40km west of Ceduna. Its own corporation, its own store.' },
  { name: 'Scotdesco', council: 'Unincorporated SA', note: 'At Bookabie, on the coast west of Ceduna.' },
  { name: 'Yalata', council: 'Unincorporated SA', note: 'About 200km west. Its corporation is registered at an address in Ceduna.' },
  { name: 'Oak Valley', council: 'Maralinga Tjarutja', note: 'About 700km north-west, on the Maralinga Tjarutja lands. Its corporation is also registered in Ceduna.' },
];

export default async function FarWestCoastPage() {
  const supabase = getServiceSupabase();

  const [ceduna5690, streaky5680, crimeResult, unplacedResult] = await Promise.all([
    getPostcodeFundingPicture('5690').catch(() => null),
    getPostcodeFundingPicture('5680').catch(() => null),
    supabase
      .from('crime_stats_lga')
      .select('lga_name, offence_group, incidents, year_period')
      .eq('state', 'SA')
      .in('lga_name', ['Ceduna', 'Maralinga Tjarutja', 'Streaky Bay'])
      .eq('offence_group', 'Total'),
    supabase
      .from('gs_entities')
      .select('id', { count: 'exact', head: true })
      .eq('postcode', '5690')
      .eq('lga_source', 'unresolved_multi_lga_postcode'),
  ]);

  const crime = (crimeResult.data || []) as Array<{ lga_name: string; incidents: number; year_period: string }>;
  const crimePeriod = crime[0]?.year_period ?? null;
  const unplaced = unplacedResult.count ?? 0;

  const committed = (ceduna5690?.activeValue ?? 0) + (streaky5680?.activeValue ?? 0);
  const ending = (ceduna5690?.endingWithin24mValue ?? 0) + (streaky5680?.endingWithin24mValue ?? 0);
  const agreements = (ceduna5690?.activeAwards ?? 0) + (streaky5680?.activeAwards ?? 0);
  const orgs = (ceduna5690?.recipients ?? 0) + (streaky5680?.recipients ?? 0);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <header className="border-b-4 border-bauhaus-black bg-white px-5 py-10 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            Where the money goes
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-tight lg:text-5xl">
            The Far West Coast
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7">
            Wirangu country, and the country of the communities along the coast west of it. Public
            money reaching organisations at Ceduna, Koonibba, Scotdesco, Yalata and Oak Valley.
            Every figure here comes from a public register and can be checked. Where we cannot tell
            you something, the page says so instead of guessing.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:px-10">
        <section aria-labelledby="money-title">
          <h2 id="money-title" className="text-xl font-black uppercase tracking-widest">
            What is committed now
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-px border-4 border-bauhaus-black bg-bauhaus-black lg:grid-cols-4">
            {[
              { label: 'Committed now', value: money(committed), tone: 'text-bauhaus-black' },
              { label: 'Ends within 24 months', value: money(ending), tone: 'text-bauhaus-red' },
              { label: 'Live agreements', value: String(agreements), tone: 'text-bauhaus-black' },
              { label: 'Organisations', value: String(orgs), tone: 'text-bauhaus-black' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white p-5">
                <div className={`text-3xl font-black ${stat.tone}`}>{stat.value}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6">
            Federal grant agreements held by organisations registered in postcodes 5690 and 5680,
            counted from GrantConnect. Values are whole-of-agreement, not annual. The second figure
            is the part of it whose agreement ends inside two years, which is the only part anyone
            can do much about right now.
          </p>
        </section>

        <section aria-labelledby="hub-title" className="border-4 border-bauhaus-black bg-white p-6">
          <h2 id="hub-title" className="text-xl font-black uppercase tracking-widest">
            Read the place names carefully
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6">
            The communities out along the coast are administered from Ceduna. Yalata Anangu
            Aboriginal Corporation is registered at an address in Ceduna, 200km from Yalata. Oak
            Valley&rsquo;s corporation is registered in Ceduna too, 700km from Oak Valley. The
            postcode, 5690, covers all of it, and so does the postal locality.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6">
            That means every automatic way of working out where an organisation sits &mdash; its
            postcode, its registered address, the town on its mail &mdash; points at Ceduna. Money
            intended for the outstations gets counted as Ceduna&rsquo;s. It is not that anyone is
            hiding it; it is that the registers only record where the paperwork lives, and out here
            the paperwork lives in town.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6">
            So treat the totals above as the coast&rsquo;s, not Ceduna&rsquo;s. Splitting them by
            community needs someone who knows which organisation serves where, and that is not a
            thing a register can tell you.
          </p>
        </section>

        <section aria-labelledby="communities-title">
          <h2 id="communities-title" className="text-xl font-black uppercase tracking-widest">
            The five communities
          </h2>
          <div className="mt-5 overflow-x-auto border-4 border-bauhaus-black bg-white">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b-4 border-bauhaus-black">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Community</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Council area</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Note</th>
                </tr>
              </thead>
              <tbody>
                {COMMUNITIES.map((community) => (
                  <tr key={community.name} className="border-b-2 border-bauhaus-black/10 last:border-b-0">
                    <td className="p-4 font-black">{community.name}</td>
                    <td className="p-4">{community.council}</td>
                    <td className="p-4 text-bauhaus-muted">{community.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6">
            Council areas come from the ABS statistical geography. Three councils cover these five
            communities, which is why a single figure for &ldquo;the Ceduna area&rdquo; is usually
            answering a different question than the one being asked.
          </p>
        </section>

        {crime.length > 0 && (
          <section aria-labelledby="crime-title">
            <h2 id="crime-title" className="text-xl font-black uppercase tracking-widest">
              Reported offences by council
            </h2>
            <div className="mt-5 grid gap-px border-4 border-bauhaus-black bg-bauhaus-black sm:grid-cols-3">
              {crime
                .slice()
                .sort((a, b) => b.incidents - a.incidents)
                .map((row) => (
                  <div key={row.lga_name} className="bg-white p-5">
                    <div className="text-3xl font-black">{row.incidents.toLocaleString('en-AU')}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      {row.lga_name}
                    </div>
                  </div>
                ))}
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6">
              All reported offences{crimePeriod ? `, ${crimePeriod}` : ''}, from SA Police, counted
              by the suburb where the offence was reported.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6">
              Until August 2026 this page would have shown 905 offences against Maralinga Tjarutja,
              because our own pipeline rolled every offence in postcode 5690 up to a single council
              and picked that one. Oak Valley, the community actually in Maralinga Tjarutja,
              reported eight offences that year. The error was ours and it is fixed; the numbers
              above are counted by suburb.
            </p>
          </section>
        )}

        <section aria-labelledby="gaps-title" className="border-4 border-bauhaus-red bg-white p-6">
          <h2 id="gaps-title" className="text-xl font-black uppercase tracking-widest text-bauhaus-red">
            What this page cannot tell you
          </h2>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-sm leading-6">
            <li>
              <strong>Which community each dollar reaches.</strong> Federal grants are counted
              against the organisation&rsquo;s registered address, and out here that address is
              usually in Ceduna regardless of where the work happens.
            </li>
            {unplaced > 0 && (
              <li>
                <strong>{unplaced} organisations in postcode 5690 have no council recorded.</strong>{' '}
                They sit in a postcode covering three, and nothing we hold says which. They are
                marked unplaced rather than assigned to a guess.
              </li>
            )}
            <li>
              <strong>Whether Ceduna&rsquo;s justice reinvestment work is funded.</strong> It appears
              in our evidence layer as a community-endorsed initiative with no funding record
              anywhere. Two other South Australian sites hold federal justice reinvestment money to
              2029. Ceduna holds none that we can see, which may mean it is funded through a channel
              we do not capture.
            </li>
            <li>
              <strong>Anything about how any of this is going.</strong> These are agreements and
              incident counts. They are not outcomes, and they are not the community&rsquo;s account
              of itself.
            </li>
          </ul>
        </section>

        <section className="text-sm leading-6">
          <Link href="/places/5690" className="font-black uppercase tracking-widest text-bauhaus-blue underline">
            Postcode 5690 in detail &rarr;
          </Link>
        </section>
      </div>
    </main>
  );
}

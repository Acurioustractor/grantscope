import Link from 'next/link';
import { getLiveReportSupabase } from '@/lib/report-supabase';

export const revalidate = 3600;

export const metadata = {
  title: 'QLD Watch-house Daily Data - CivicGraph',
  description: 'Queensland watch-house custody snapshot linked to youth detention, remand, orders, court and support-service context.',
};

const qpsPageUrl = 'https://www.police.qld.gov.au/qps-corporate-documents/reports-and-publications/watch-house-data';
const qpsPdfUrl = 'https://open-crime-data.s3.ap-southeast-2.amazonaws.com/Crime%20Statistics/Persons%20Currently%20In%20Watchhouse%20Custody.pdf';
const qgsoJusticeReportUrl = 'https://www.qgso.qld.gov.au/issues/7876/justice-report-qld-2023-24.pdf';
const aihwQldUrl = 'https://www.aihw.gov.au/reports/youth-justice/youth-justice-in-australia-2023-24/contents/state-and-territory-overviews/queensland';
const qpsReviewUrl = 'https://www.police.qld.gov.au/sites/default/files/2025-08/QPS%20Watch-house%20Review%202025.pdf';
const qfccReportUrl = 'https://www.qfcc.qld.gov.au/sites/default/files/report-queensland-child-rights-report-2025.pdf';

type WatchhouseRow = {
  name: string;
  children: number;
  firstNationsChildren: number;
  nonIndigenousChildren: number;
  femaleChildren: number;
  zeroToTwoDays: number;
  threeToSevenDays: number;
  overSevenDays: number;
  longestDays: number;
};

const fallbackWatchhouseSnapshot = {
  generatedAt: 'Tuesday 21 April 2026, 6:00 AM',
  releaseCadence: '6am and 6pm daily',
  fetchedNote: 'The QPS page points to a fixed PDF URL. When this page was built, that PDF generated timestamp was 21 April 2026 at 06:00.',
  totals: {
    all: 558,
    adult: 536,
    child: 22,
    childFirstNations: 18,
    childNonIndigenous: 4,
    childFemale: 3,
    childZeroToTwoDays: 20,
    childThreeToSevenDays: 2,
    childOverSevenDays: 0,
    childLongestDays: 4,
    adultOverSevenDays: 145,
  },
};

const fallbackChildRows: WatchhouseRow[] = [
  { name: 'Brisbane Watch-house', children: 4, firstNationsChildren: 4, nonIndigenousChildren: 0, femaleChildren: 0, zeroToTwoDays: 4, threeToSevenDays: 0, overSevenDays: 0, longestDays: 1 },
  { name: 'Cairns Watch-house', children: 6, firstNationsChildren: 5, nonIndigenousChildren: 1, femaleChildren: 1, zeroToTwoDays: 6, threeToSevenDays: 0, overSevenDays: 0, longestDays: 2 },
  { name: 'Doomadgee Watch-house', children: 1, firstNationsChildren: 1, nonIndigenousChildren: 0, femaleChildren: 0, zeroToTwoDays: 1, threeToSevenDays: 0, overSevenDays: 0, longestDays: 2 },
  { name: 'Ipswich District Watch-house', children: 1, firstNationsChildren: 1, nonIndigenousChildren: 0, femaleChildren: 0, zeroToTwoDays: 1, threeToSevenDays: 0, overSevenDays: 0, longestDays: 0 },
  { name: 'Mount Isa Watch-house', children: 3, firstNationsChildren: 3, nonIndigenousChildren: 0, femaleChildren: 1, zeroToTwoDays: 3, threeToSevenDays: 0, overSevenDays: 0, longestDays: 2 },
  { name: 'Normanton Watch-house', children: 1, firstNationsChildren: 1, nonIndigenousChildren: 0, femaleChildren: 0, zeroToTwoDays: 1, threeToSevenDays: 0, overSevenDays: 0, longestDays: 0 },
  { name: 'Pine Rivers Watch-house', children: 1, firstNationsChildren: 0, nonIndigenousChildren: 1, femaleChildren: 0, zeroToTwoDays: 1, threeToSevenDays: 0, overSevenDays: 0, longestDays: 1 },
  { name: 'Rockhampton Watch-house', children: 3, firstNationsChildren: 2, nonIndigenousChildren: 1, femaleChildren: 1, zeroToTwoDays: 1, threeToSevenDays: 2, overSevenDays: 0, longestDays: 4 },
  { name: 'Southport Watch-house', children: 1, firstNationsChildren: 0, nonIndigenousChildren: 1, femaleChildren: 0, zeroToTwoDays: 1, threeToSevenDays: 0, overSevenDays: 0, longestDays: 1 },
  { name: 'Toowoomba Watch-house', children: 1, firstNationsChildren: 1, nonIndigenousChildren: 0, femaleChildren: 0, zeroToTwoDays: 1, threeToSevenDays: 0, overSevenDays: 0, longestDays: 0 },
];

const contextMetrics = [
  {
    label: 'Detention centres',
    value: '286',
    detail: 'average daily young people in Queensland youth detention centres in 2023-24',
    source: 'QGSO Justice report, Table 66',
    status: 'annual context',
  },
  {
    label: 'Unsentenced detention',
    value: '246',
    detail: '245 remand plus 1 pre-court custody on an average day in youth detention centres',
    source: 'QGSO Justice report, Table 67',
    status: 'annual context',
  },
  {
    label: 'Youth justice supervision',
    value: '1,598',
    detail: 'young people under any youth justice supervision on an average day in Queensland',
    source: 'AIHW Youth Justice in Australia 2023-24',
    status: 'annual context',
  },
  {
    label: 'Community supervision',
    value: '81%',
    detail: 'share of supervised young people who were supervised in the community on an average day',
    source: 'AIHW Youth Justice in Australia 2023-24',
    status: 'annual context',
  },
  {
    label: 'Youth justice order admissions',
    value: '9,679',
    detail: 'admissions to supervised, unsupervised, and other youth justice orders in 2023-24',
    source: 'QGSO Justice report, Table 53',
    status: 'annual context',
  },
  {
    label: 'Court appearances',
    value: '3,814',
    detail: 'unique child defendants with at least one finalised court appearance in 2023-24',
    source: 'QGSO Justice report, youth justice courts section',
    status: 'annual context',
  },
];

const qgsoOrderRows = [
  { label: 'Supervised orders', value: '3,291', note: 'Includes detention and community-based supervised orders.' },
  { label: 'Community-based supervised orders', value: '2,902', note: 'Probation, community service, restorative justice, conditional release and related orders.' },
  { label: 'Detention-based supervised orders', value: '389', note: 'Detention-based order admissions, excluding suspended detention tied to conditional release.' },
  { label: 'Unsupervised orders', value: '3,682', note: 'Fine, good behaviour and reprimand orders.' },
  { label: 'Other orders', value: '2,706', note: 'Ancillary and other order categories.' },
];

const watchhouseAnnualRows = [
  {
    year: '2021-22',
    total: 8028,
    oneDayOrLess: 6053,
    twoDays: 1140,
    threeToFourDays: 398,
    fiveToSevenDays: 288,
    eightToFourteenDays: 147,
    fifteenPlusDays: 2,
  },
  {
    year: '2022-23',
    total: 8100,
    oneDayOrLess: 5479,
    twoDays: 1303,
    threeToFourDays: 391,
    fiveToSevenDays: 401,
    eightToFourteenDays: 398,
    fifteenPlusDays: 128,
  },
  {
    year: '2023-24',
    total: 7807,
    oneDayOrLess: 5237,
    twoDays: 1185,
    threeToFourDays: 354,
    fiveToSevenDays: 343,
    eightToFourteenDays: 440,
    fifteenPlusDays: 248,
  },
];

const supervisedOrderTrendRows = [
  { year: '2014-15', admissions: 3448 },
  { year: '2015-16', admissions: 3392 },
  { year: '2016-17', admissions: 3200 },
  { year: '2017-18', admissions: 3789 },
  { year: '2018-19', admissions: 4017 },
  { year: '2019-20', admissions: 2994 },
  { year: '2020-21', admissions: 3452 },
  { year: '2021-22', admissions: 3253 },
  { year: '2022-23', admissions: 3170 },
  { year: '2023-24', admissions: 3291 },
];

const relevantDataRows = [
  {
    dataset: 'QPS twice-daily watch-house PDF',
    question: 'How many people and children are in each watch-house right now?',
    cadence: '6am and 6pm',
    currentUse: 'Daily snapshot table on this page.',
    nextMove: 'Automate fetch, parse, and store every timestamp before the fixed PDF is overwritten.',
    status: 'live source, not yet persisted',
  },
  {
    dataset: 'QFCC Child Rights Report 2025',
    question: 'How many times were children held in watch-houses each year, and for how long?',
    cadence: 'annual report',
    currentUse: 'Yearly length-of-stay table on this page.',
    nextMove: 'Backfill monthly counts if QPS/QFCC can provide the underlying unpublished data.',
    status: 'summarised here',
  },
  {
    dataset: 'QPS Watch-house Review 2025',
    question: 'How big is the watch-house system and how many admissions does it process?',
    cadence: 'review report',
    currentUse: 'System context: 63 watch-houses, 891 beds, 555 cells, 2024 admissions.',
    nextMove: 'Extract the full review tables and annexure into the tracker evidence layer.',
    status: 'summarised here',
  },
  {
    dataset: 'QGSO Justice report',
    question: 'What is happening in youth detention, remand, courts, and youth justice orders?',
    cadence: 'annual release',
    currentUse: 'Detention, remand, court, and order baselines on this page.',
    nextMove: 'Import all youth justice tables as structured annual time series.',
    status: 'partly surfaced',
  },
  {
    dataset: 'AIHW Youth Justice in Australia',
    question: 'What is the average daily supervision picture across detention and community?',
    cadence: 'annual release',
    currentUse: 'Average daily supervision and detention/community split.',
    nextMove: 'Keep as a national comparator layer beside QGSO state figures.',
    status: 'partly surfaced',
  },
  {
    dataset: 'CivicGraph justice_funding and supplier map',
    question: 'Who is funded to deliver bail, watch-house support, prevention, and throughcare?',
    cadence: 'database refresh',
    currentUse: 'Linked through delivery ledger, announcements, supplier map, and trackers.',
    nextMove: 'Join providers to ABNs, contracts, contacts, GHL outreach, and story collection status.',
    status: 'connected elsewhere',
  },
];

const sourceStatusRows = [
  {
    area: 'Watch-house custody',
    currentSignal: 'QPS statewide PDF, released at 6am and 6pm',
    whatWeHave: 'The latest stored QPS snapshot is now read from qld_watchhouse_snapshots when available.',
    gap: 'Needs continuous twice-daily collection so the yearly point-in-time series grows from here.',
    tone: 'green',
  },
  {
    area: 'Youth detention centres',
    currentSignal: 'QGSO annual average daily number, plus AIHW annual supervision dataset',
    whatWeHave: '286 in QGSO detention-centre average; 318.3 in AIHW supervision/detention dataset definitions',
    gap: 'No current public daily occupancy feed found in this pass.',
    tone: 'amber',
  },
  {
    area: 'Remand and pre-court custody',
    currentSignal: 'QGSO legal-status table and QFCC Child Rights summary',
    whatWeHave: '246 average daily unsentenced detention in 2023-24: 245 remand and 1 pre-court custody',
    gap: 'No daily court/remand queue feed found yet.',
    tone: 'amber',
  },
  {
    area: 'Service centres and orders',
    currentSignal: 'QGSO youth justice order admissions and AIHW community supervision',
    whatWeHave: '9,679 order admissions and 1,598 average daily supervision context',
    gap: 'Need service-centre caseloads, local queues, breach flows, and current order counts.',
    tone: 'amber',
  },
  {
    area: 'Watch-house support providers',
    currentSignal: 'CivicGraph tracker evidence and justice_funding mirror',
    whatWeHave: 'Murri Watch, Youth Advocacy Centre, Caboolture Hub and Wacol traces already in the tracker',
    gap: 'Need live provider roster, service coverage, and contact/referral details for each watch-house region.',
    tone: 'blue',
  },
];

function toneClasses(tone: string) {
  if (tone === 'green') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (tone === 'blue') return 'border-blue-300 bg-blue-50 text-blue-700';
  return 'border-amber-300 bg-amber-50 text-amber-700';
}

function dayLabel(days: number) {
  return days === 0 ? 'same day' : `${days}d`;
}

function formatNumber(value: number) {
  return value.toLocaleString('en-AU');
}

type LatestSnapshotRow = {
  source_generated_at: string | null;
  total_people: number | null;
  total_adults: number | null;
  total_children: number | null;
  child_first_nations: number | null;
  child_non_indigenous: number | null;
  child_0_2_days: number | null;
  child_3_7_days: number | null;
  child_over_7_days: number | null;
  child_longest_days: number | null;
  adult_over_7_days: number | null;
  rows: Array<Record<string, unknown>> | null;
};

function formatGeneratedAt(value: string | null) {
  if (!value) return fallbackWatchhouseSnapshot.generatedAt;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallbackWatchhouseSnapshot.generatedAt;
  return parsed.toLocaleString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Australia/Brisbane',
    timeZoneName: 'short',
  });
}

async function loadLatestWatchhouseSnapshot() {
  try {
    const { data, error } = await getLiveReportSupabase()
      .from('v_qld_watchhouse_latest')
      .select('*')
      .maybeSingle();

    if (error || !data) {
      return {
        watchhouseSnapshot: fallbackWatchhouseSnapshot,
        childRows: fallbackChildRows,
        isLiveSnapshot: false,
      };
    }

    const latest = data as LatestSnapshotRow;
    const liveChildRows = (latest.rows || [])
      .filter((row) => row.age_group === 'Child' && Number(row.total_in_custody || 0) > 0)
      .map((row): WatchhouseRow => ({
        name: String(row.watchhouse_name || 'Unknown watch-house'),
        children: Number(row.total_in_custody || 0),
        firstNationsChildren: Number(row.first_nations || 0),
        nonIndigenousChildren: Number(row.non_indigenous || 0),
        femaleChildren: Number(row.female || 0),
        zeroToTwoDays: Number(row.custody_0_2_days || 0),
        threeToSevenDays: Number(row.custody_3_7_days || 0),
        overSevenDays: Number(row.custody_over_7_days || 0),
        longestDays: Number(row.longest_days || 0),
      }));

    return {
      watchhouseSnapshot: {
        generatedAt: formatGeneratedAt(latest.source_generated_at),
        releaseCadence: fallbackWatchhouseSnapshot.releaseCadence,
        fetchedNote:
          'Loaded from the stored CivicGraph snapshot table. The automation preserves each QPS generated timestamp so this can become a daily time series.',
        totals: {
          all: Number(latest.total_people || 0),
          adult: Number(latest.total_adults || 0),
          child: Number(latest.total_children || 0),
          childFirstNations: Number(latest.child_first_nations || 0),
          childNonIndigenous: Number(latest.child_non_indigenous || 0),
          childFemale: liveChildRows.reduce((sum, row) => sum + row.femaleChildren, 0),
          childZeroToTwoDays: Number(latest.child_0_2_days || 0),
          childThreeToSevenDays: Number(latest.child_3_7_days || 0),
          childOverSevenDays: Number(latest.child_over_7_days || 0),
          childLongestDays: Number(latest.child_longest_days || 0),
          adultOverSevenDays: Number(latest.adult_over_7_days || 0),
        },
      },
      childRows: liveChildRows.length > 0 ? liveChildRows : fallbackChildRows,
      isLiveSnapshot: true,
    };
  } catch {
    return {
      watchhouseSnapshot: fallbackWatchhouseSnapshot,
      childRows: fallbackChildRows,
      isLiveSnapshot: false,
    };
  }
}

export default async function QldWatchhouseDataPage() {
  const { watchhouseSnapshot, childRows, isLiveSnapshot } = await loadLatestWatchhouseSnapshot();
  const childSites = childRows.length;
  const watchhouseThreeYearTotal = watchhouseAnnualRows.reduce((sum, row) => sum + row.total, 0);
  const watchhouseOverWeekTotal = watchhouseAnnualRows.reduce((sum, row) => sum + row.eightToFourteenDays + row.fifteenPlusDays, 0);
  const supervisedOrderTenYearTotal = supervisedOrderTrendRows.reduce((sum, row) => sum + row.admissions, 0);
  const maxSupervisedAdmissions = Math.max(...supervisedOrderTrendRows.map((row) => row.admissions));

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-8">
        <Link
          href="/reports/youth-justice/qld/trackers/watchhouse-support"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; Watch-house support tracker
        </Link>
        <div className="mt-5 text-xs font-black uppercase tracking-widest text-bauhaus-red">QLD daily custody signal</div>
        <div className="mt-2 grid gap-6 xl:grid-cols-[1fr,420px] xl:items-end">
          <div>
            <h1 className="max-w-5xl text-4xl font-black leading-tight text-bauhaus-black sm:text-5xl">
              Watch-house custody, detention and remand
            </h1>
            <p className="mt-4 max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
              This page separates the live daily QPS watch-house count from the annual detention, court, order and supervision
              context. That matters: watch-house data is current custody pressure, while detention, remand and orders still rely on
              annual public releases until a daily source is found or requested.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Latest fetched QPS PDF</div>
            <div className="mt-2 text-2xl font-black text-bauhaus-black">{watchhouseSnapshot.generatedAt}</div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{watchhouseSnapshot.fetchedNote}</p>
            <div className={`mt-3 inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
              isLiveSnapshot
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-amber-300 bg-amber-50 text-amber-700'
            }`}>
              {isLiveSnapshot ? 'Stored snapshot' : 'Static fallback'}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={qpsPageUrl}
                target="_blank"
                rel="noreferrer"
                className="border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
              >
                QPS source
              </a>
              <a
                href={qpsPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="border-2 border-bauhaus-blue px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white"
              >
                Current PDF
              </a>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="All people in watch-houses" value={watchhouseSnapshot.totals.all.toLocaleString()} note="QPS statewide custody total" tone="black" />
        <MetricCard label="Children in watch-houses" value={watchhouseSnapshot.totals.child.toLocaleString()} note={`${childSites} watch-houses with children`} tone="red" />
        <MetricCard label="First Nations children" value={watchhouseSnapshot.totals.childFirstNations.toLocaleString()} note="18 of 22 children in the snapshot" tone="red" />
        <MetricCard label="Children 3-7 days" value={watchhouseSnapshot.totals.childThreeToSevenDays.toLocaleString()} note="No children over 7 days in this snapshot" tone="amber" />
        <MetricCard label="Longest child stay" value={`${watchhouseSnapshot.totals.childLongestDays}d`} note="Rockhampton in the fetched PDF" tone="amber" />
        <MetricCard label="Adults over 7 days" value={watchhouseSnapshot.totals.adultOverSevenDays.toLocaleString()} note="Adult custody pressure still matters" tone="blue" />
      </section>

      <section className="mb-10 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Daily watch-house table</div>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Where children were held in the QPS snapshot</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
              These are the child rows visible in the QPS PDF. The next system step is to store every 6am and 6pm PDF as a
              dated snapshot, then alert when children appear, stay longer than 72 hours, or move between locations.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Watch-house</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Children</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">First Nations</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Non-Indigenous</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Female</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">0-2d</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">3-7d</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Longest</th>
                </tr>
              </thead>
              <tbody>
                {childRows.map((row) => (
                  <tr key={row.name} className="border-b border-gray-200 align-top last:border-b-0">
                    <td className="px-4 py-3 font-black text-bauhaus-black">{row.name}</td>
                    <td className="px-4 py-3 text-right font-black text-bauhaus-red">{row.children}</td>
                    <td className="px-4 py-3 text-right">{row.firstNationsChildren}</td>
                    <td className="px-4 py-3 text-right">{row.nonIndigenousChildren}</td>
                    <td className="px-4 py-3 text-right">{row.femaleChildren}</td>
                    <td className="px-4 py-3 text-right">{row.zeroToTwoDays}</td>
                    <td className="px-4 py-3 text-right">{row.threeToSevenDays}</td>
                    <td className="px-4 py-3 text-right font-black">{dayLabel(row.longestDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="border-4 border-bauhaus-black bg-bauhaus-black p-5 text-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Why QPS publishes this</div>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              The QPS source says this reporting was created for open watch-house capacity reporting and responds to
              Women&apos;s Safety and Justice Taskforce recommendations and Queensland Human Rights Commission requests.
            </p>
          </div>
          <div className="border-2 border-bauhaus-black bg-white p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Watch-house system context</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniStat value="63" label="watch-houses" />
              <MiniStat value="891" label="beds" />
              <MiniStat value="555" label="cells" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-bauhaus-muted">
              QPS&apos;s 2025 review says watch-houses are short-term holding facilities and are generally not designed or
              resourced to hold prisoners beyond 72 hours.
            </p>
          </div>
          <div className="border-2 border-bauhaus-black bg-white p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Annual child impact</div>
            <div className="mt-2 text-3xl font-black text-bauhaus-black">7,807</div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              QFCC reports 7,807 times children and young people were held in watch-houses or police stations in 2023-24,
              with 59.2% recorded as First Nations.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10 border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Yearly and all-time context</div>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Is today&apos;s number part of a bigger pattern?</h2>
          <p className="mt-2 max-w-5xl text-sm leading-relaxed text-bauhaus-muted">
            The QPS PDF tells us the current custody pressure. The yearly tables show the longer pattern: thousands of child
            watch-house episodes each year, more children staying over a week, and a decade of youth justice order admissions that
            should be read beside detention, remand and watch-house pressure.
          </p>
        </div>

        <div className="grid gap-4 border-b border-gray-200 p-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Child watch-house episodes"
            value={formatNumber(watchhouseThreeYearTotal)}
            note="2021-22 to 2023-24 QFCC/QPS series"
            tone="red"
          />
          <MetricCard
            label="Child stays over 7 days"
            value={formatNumber(watchhouseOverWeekTotal)}
            note="8-14 days plus 15+ days, 2021-22 to 2023-24"
            tone="amber"
          />
          <MetricCard
            label="Supervised order admissions"
            value={formatNumber(supervisedOrderTenYearTotal)}
            note="2014-15 to 2023-24 QGSO time series"
            tone="blue"
          />
          <MetricCard
            label="2024 watch-house admissions"
            value="78,108"
            note="QPS review total admissions; 7,432 were children"
            tone="black"
          />
        </div>

        <div className="grid gap-6 p-5 xl:grid-cols-[1.15fr,0.85fr]">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">QFCC annual watch-house data</div>
            <h3 className="mt-1 text-xl font-black text-bauhaus-black">Children held in watch-houses and police stations</h3>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              This is the strongest annual watch-house series found so far. It counts times children and young people were held,
              not unique children. The over-seven-day column is the clearest escalation signal.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="bg-bauhaus-black text-white">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Year</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Total</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">1 day or less</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">2 days</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">3-4d</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">5-7d</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">8-14d</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">15+d</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">&gt;7d</th>
                  </tr>
                </thead>
                <tbody>
                  {watchhouseAnnualRows.map((row) => {
                    const overSeven = row.eightToFourteenDays + row.fifteenPlusDays;

                    return (
                      <tr key={row.year} className="border-b border-gray-200 align-top last:border-b-0">
                        <td className="px-4 py-3 font-black text-bauhaus-black">{row.year}</td>
                        <td className="px-4 py-3 text-right font-black">{formatNumber(row.total)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.oneDayOrLess)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.twoDays)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.threeToFourDays)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.fiveToSevenDays)}</td>
                        <td className="px-4 py-3 text-right text-amber-700">{formatNumber(row.eightToFourteenDays)}</td>
                        <td className="px-4 py-3 text-right text-bauhaus-red">{formatNumber(row.fifteenPlusDays)}</td>
                        <td className="px-4 py-3 text-right font-black text-bauhaus-red">{formatNumber(overSeven)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">QGSO 10-year order series</div>
            <h3 className="mt-1 text-xl font-black text-bauhaus-black">Supervised youth justice order admissions</h3>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              This is not the daily service-centre caseload, but it shows the scale of the community and detention order system
              feeding into watch-house pressure.
            </p>
            <div className="mt-4 space-y-2">
              {supervisedOrderTrendRows.map((row) => (
                <div key={row.year} className="grid grid-cols-[78px,1fr,72px] items-center gap-3">
                  <div className="text-xs font-black uppercase tracking-wider text-bauhaus-muted">{row.year}</div>
                  <div className="h-3 bg-gray-200">
                    <div
                      className="h-3 bg-bauhaus-blue"
                      style={{ width: `${Math.max(8, Math.round((row.admissions / maxSupervisedAdmissions) * 100))}%` }}
                    />
                  </div>
                  <div className="text-right text-sm font-black text-bauhaus-black">{formatNumber(row.admissions)}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-bauhaus-muted">
              Note: QGSO marks a time-series break in 2017-18 due to the inclusion of 17-year-old offenders in the youth justice
              system from February 2018.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10 border-4 border-bauhaus-black bg-white p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Detention, remand, court and orders context</div>
        <h2 className="mt-1 text-2xl font-black text-bauhaus-black">The daily watch-house count needs these annual baselines beside it</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contextMetrics.map((metric) => (
            <div key={metric.label} className="border-2 border-gray-200 bg-bauhaus-canvas p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{metric.status}</div>
              <div className="mt-2 text-3xl font-black text-bauhaus-black">{metric.value}</div>
              <div className="mt-1 text-sm font-black text-bauhaus-black">{metric.label}</div>
              <p className="mt-2 text-xs leading-relaxed text-bauhaus-muted">{metric.detail}</p>
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{metric.source}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10 grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <div className="border-4 border-bauhaus-black bg-white p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Youth justice orders</div>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">What the order system shows</h2>
          <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
            These are admissions to orders, not current daily caseload. They are still useful because they show the size of the
            community pathway that should sit upstream from watch-houses and detention.
          </p>
          <div className="mt-5 space-y-3">
            {qgsoOrderRows.map((row) => (
              <div key={row.label} className="grid gap-3 border border-gray-200 p-3 sm:grid-cols-[120px,1fr]">
                <div>
                  <div className="text-2xl font-black text-bauhaus-black">{row.value}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">2023-24</div>
                </div>
                <div>
                  <div className="font-black text-bauhaus-black">{row.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-bauhaus-muted">{row.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">What is live and what is still missing</div>
          <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Source status by question</h2>
          <div className="mt-5 space-y-3">
            {sourceStatusRows.map((row) => (
              <div key={row.area} className="grid gap-3 border border-gray-200 p-4 lg:grid-cols-[190px,1fr]">
                <div>
                  <div className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${toneClasses(row.tone)}`}>
                    {row.area}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-black text-bauhaus-black">{row.currentSignal}</div>
                  <p className="mt-1 text-sm leading-relaxed text-bauhaus-muted">{row.whatWeHave}</p>
                  <p className="mt-2 text-xs font-bold leading-relaxed text-bauhaus-muted">
                    <span className="font-black text-bauhaus-red">Gap:</span> {row.gap}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-10 border-4 border-bauhaus-black bg-white p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Relevant data map</div>
        <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Where the rest of the data sits</h2>
        <p className="mt-2 max-w-5xl text-sm leading-relaxed text-bauhaus-muted">
          This is the full data shape for the page. The watch-house PDF is only one layer. The useful operating view needs daily
          custody, annual justice context, funding/provider data, and outreach/status data in one place.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Dataset</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Question it answers</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Cadence</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Shown now</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Next system move</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {relevantDataRows.map((row) => (
                <tr key={row.dataset} className="border-b border-gray-200 align-top last:border-b-0">
                  <td className="px-4 py-3 font-black text-bauhaus-black">{row.dataset}</td>
                  <td className="px-4 py-3 text-bauhaus-muted">{row.question}</td>
                  <td className="px-4 py-3 font-bold text-bauhaus-black">{row.cadence}</td>
                  <td className="px-4 py-3 text-bauhaus-muted">{row.currentUse}</td>
                  <td className="px-4 py-3 text-bauhaus-muted">{row.nextMove}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex border border-bauhaus-blue bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10 border-4 border-bauhaus-black bg-white p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Build this into a working tracker</div>
        <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Refresh path for the next build</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkflowStep step="1" title="Fetch twice daily" body="Pull the fixed QPS PDF URL after 6am and 6pm and record the PDF generated timestamp." />
          <WorkflowStep step="2" title="Parse rows" body="Extract every watch-house row by age group, First Nations status, gender and custody duration bucket." />
          <WorkflowStep step="3" title="Store snapshots" body="Write to a dated watch-house snapshot table and keep history rather than overwriting the current PDF." />
          <WorkflowStep step="4" title="Trigger action" body="Alert when children appear, stays exceed 72 hours, numbers spike, or a region lacks visible support-service evidence." />
        </div>
      </section>

      <section className="mb-10 border-4 border-bauhaus-black bg-white p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Source chain</div>
        <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Where each number comes from</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SourceLink href={qpsPageUrl} title="QPS Watch-house data page" body="Release cadence and current PDF link." />
          <SourceLink href={qpsPdfUrl} title="QPS current custody PDF" body="Generated snapshot used for the child location table." />
          <SourceLink href={qpsReviewUrl} title="QPS Watch-house Review 2025" body="Network size, 72-hour suitability, admissions and operating context." />
          <SourceLink href={qgsoJusticeReportUrl} title="QGSO Justice report 2023-24" body="Court, youth justice orders, detention-centre and legal-status tables." />
          <SourceLink href={aihwQldUrl} title="AIHW Queensland youth justice overview" body="Youth justice supervision, community and detention average-day context." />
          <SourceLink href={qfccReportUrl} title="QFCC Child Rights Report 2025" body="Watch-house annual child counts, remand and rights context." />
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'black' | 'red' | 'amber' | 'blue';
}) {
  const valueClass = {
    black: 'text-bauhaus-black',
    red: 'text-bauhaus-red',
    amber: 'text-amber-600',
    blue: 'text-bauhaus-blue',
  }[tone];

  return (
    <div className="border-2 border-bauhaus-black bg-white p-4 text-center">
      <div className={`text-3xl font-black ${valueClass}`}>{value}</div>
      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">{label}</div>
      <p className="mt-2 text-xs leading-relaxed text-bauhaus-muted">{note}</p>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-gray-200 bg-bauhaus-canvas p-3">
      <div className="text-xl font-black text-bauhaus-black">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
    </div>
  );
}

function WorkflowStep({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="border-2 border-gray-200 bg-bauhaus-canvas p-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Step {step}</div>
      <h3 className="mt-2 text-lg font-black text-bauhaus-black">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{body}</p>
    </div>
  );
}

function SourceLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group border-2 border-gray-200 bg-bauhaus-canvas p-4 hover:border-bauhaus-blue hover:bg-blue-50"
    >
      <div className="text-sm font-black text-bauhaus-black group-hover:text-bauhaus-blue">{title}</div>
      <p className="mt-2 text-xs leading-relaxed text-bauhaus-muted">{body}</p>
      <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Open source &rarr;</div>
    </a>
  );
}

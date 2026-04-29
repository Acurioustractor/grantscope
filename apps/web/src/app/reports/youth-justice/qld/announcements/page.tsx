import Link from 'next/link';
import { fmt, money } from '@/lib/services/report-service';
import {
  qldAnnouncementStatusClass,
  qldAnnouncementStatusLabel,
  qldYouthJusticeAnnouncements,
} from '@/lib/reports/qld-youth-justice-announcements';

export const revalidate = 3600;

export const metadata = {
  title: 'QLD Youth Justice Announcements — CivicGraph',
  description: 'Baselined QLD youth justice announcement register with service, provider, evidence, and outreach leads.',
};

export default function QldYouthJusticeAnnouncementsPage() {
  const announcedTotal = qldYouthJusticeAnnouncements.reduce((sum, item) => sum + item.amountValue, 0);
  const providerLeads = qldYouthJusticeAnnouncements.reduce((sum, item) => sum + item.providerLeads.length, 0);
  const sourceCount = qldYouthJusticeAnnouncements.reduce((sum, item) => sum + item.sourceLinks.length, 0);
  const sqlSignals = qldYouthJusticeAnnouncements.filter((item) => ['named-sql', 'provider-sql'].includes(item.status)).length;

  return (
    <div className="w-full max-w-none">
      <div className="mb-8">
        <Link
          href="/reports/youth-justice/qld"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; Queensland Youth Justice
        </Link>
        <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Announcement register</div>
        <h1 className="text-3xl font-black text-bauhaus-black sm:text-4xl">
          QLD Youth Justice Announcements
        </h1>
        <p className="mt-3 max-w-4xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          A baselined register of the named 2025-26 youth justice commitments. Each page turns an announcement into
          service leads, provider matching work, source references, and JusticeHub storytelling prompts.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/reports/youth-justice/qld/announcements/services"
            className="border-2 border-bauhaus-black bg-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-white hover:text-bauhaus-black"
          >
            Supplier / service map
          </Link>
          <Link
            href="/reports/youth-justice/qld/trackers"
            className="border-2 border-bauhaus-black bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
          >
            Provider trackers
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4 2xl:grid-cols-4">
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-black">{fmt(qldYouthJusticeAnnouncements.length)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">announcements baselined</div>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-black">{money(announcedTotal)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">announced value tracked</div>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-blue">{fmt(sqlSignals)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">with SQL/provider signal</div>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-red">{fmt(providerLeads)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">provider or service leads</div>
        </div>
      </div>

      <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="border-2 border-bauhaus-black bg-bauhaus-canvas p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">How to use this</div>
          <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
            Open an announcement, resolve every named service and provider, then move confirmed leads into the tracker,
            GHL, JusticeHub outreach, or the next article brief. The goal is not another static report. It is a working
            map from public commitment to real delivery, real people, and real evidence.
          </p>
          <Link
            href="/reports/youth-justice/qld/announcements/services"
            className="mt-4 inline-block text-xs font-black uppercase tracking-widest text-bauhaus-blue hover:underline"
          >
            See the cross-initiative supplier list &rarr;
          </Link>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">What this is for</div>
          <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
            Use this register to turn government promises into a working evidence trail. Start with an announcement,
            match the named services to ABNs and CivicGraph records, check what funding proof exists, then ask providers
            and communities what the public data cannot show.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {qldYouthJusticeAnnouncements.map((item) => (
          <Link
            key={item.slug}
            href={`/reports/youth-justice/qld/announcements/${item.slug}`}
            className="group flex h-full min-h-[320px] flex-col border-4 border-bauhaus-black bg-white p-5 transition-transform hover:-translate-y-1"
          >
            <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${qldAnnouncementStatusClass(item.status)}`}>
                    {qldAnnouncementStatusLabel(item.status)}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{item.sourceLabel}</span>
                </div>
                <h2 className="mt-3 text-2xl font-black text-bauhaus-black">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">{item.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.serviceAreas.slice(0, 5).map((service) => (
                    <span key={service} className="border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 self-start text-right text-xs">
                <div className="min-h-[96px] border border-gray-200 p-3">
                  <div className="break-words text-lg font-black leading-tight text-bauhaus-black">{item.amountLabel}</div>
                  <div className="text-bauhaus-muted">announced</div>
                </div>
                <div className="min-h-[96px] border border-gray-200 p-3">
                  <div className="text-lg font-black text-bauhaus-blue">{fmt(item.providerLeads.length)}</div>
                  <div className="text-bauhaus-muted">provider leads</div>
                </div>
                <div className="min-h-[96px] border border-gray-200 p-3">
                  <div className="text-lg font-black text-bauhaus-red">{fmt(item.missingProof.length)}</div>
                  <div className="text-bauhaus-muted">proof gaps</div>
                </div>
                <div className="min-h-[96px] border border-gray-200 p-3">
                  <div className="text-lg font-black text-bauhaus-black">{fmt(item.sourceLinks.length)}</div>
                  <div className="text-bauhaus-muted">references</div>
                </div>
              </div>
            </div>
            <div className="mt-auto border-t border-gray-200 pt-4 text-xs font-black uppercase tracking-widest text-bauhaus-blue group-hover:underline">
              Open announcement workspace &rarr;
            </div>
          </Link>
        ))}
      </section>

      <div className="mt-8 border-2 border-bauhaus-black bg-gray-50 p-5 text-sm leading-relaxed text-bauhaus-muted">
        Source count: {fmt(sourceCount)} references across budget papers, ministerial statements, tracker evidence, and
        local investigation pages. Next pass should hydrate QTenders, DYJVS contract disclosures, grant recipient lists,
        Hansard/QON mentions, and provider announcements into the same register.
      </div>
    </div>
  );
}

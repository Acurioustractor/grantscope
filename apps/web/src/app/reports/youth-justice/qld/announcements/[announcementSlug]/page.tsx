import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmt } from '@/lib/services/report-service';
import {
  type QldAnnouncementProviderLead,
  getQldAnnouncement,
  qldAnnouncementStatusClass,
  qldAnnouncementStatusLabel,
  qldYouthJusticeAnnouncements,
} from '@/lib/reports/qld-youth-justice-announcements';
import { CopyButton } from './copy-button';

export const revalidate = 3600;

export function generateStaticParams() {
  return qldYouthJusticeAnnouncements.map((announcement) => ({ announcementSlug: announcement.slug }));
}

function entityStatusLabel(lead: QldAnnouncementProviderLead) {
  const status = lead.entityStatus ?? (lead.gsId || lead.abn ? 'linked' : 'needs-confirmation');
  const labels: Record<NonNullable<QldAnnouncementProviderLead['entityStatus']>, string> = {
    linked: 'Known',
    'likely-match': 'Likely match',
    'needs-abn': 'Needs ABN',
    'needs-contact': 'Needs contact',
    'needs-confirmation': 'Needs confirmation',
    'system-actor': 'System actor',
  };
  return labels[status];
}

function entityStatusClass(lead: QldAnnouncementProviderLead) {
  const status = lead.entityStatus ?? (lead.gsId || lead.abn ? 'linked' : 'needs-confirmation');
  const styles: Record<NonNullable<QldAnnouncementProviderLead['entityStatus']>, string> = {
    linked: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    'likely-match': 'border-blue-300 bg-blue-50 text-blue-800',
    'needs-abn': 'border-amber-300 bg-amber-50 text-amber-800',
    'needs-contact': 'border-amber-300 bg-amber-50 text-amber-800',
    'needs-confirmation': 'border-amber-300 bg-amber-50 text-amber-800',
    'system-actor': 'border-gray-300 bg-gray-50 text-gray-700',
  };
  return styles[status];
}

function entityHref(lead: QldAnnouncementProviderLead) {
  if (lead.gsId) return `/entity/${encodeURIComponent(lead.gsId)}`;
  if (lead.abn) return `/entity/AU-ABN-${encodeURIComponent(lead.abn)}`;
  return null;
}

function outreachMove(lead: QldAnnouncementProviderLead) {
  if (lead.outreachAngle) return lead.outreachAngle;
  if (lead.entityStatus === 'system-actor') return 'Name the actual provider, delivery unit, or place owner first, then resolve the ABN and contact path.';
  if (lead.askNext?.[0]) return lead.askNext[0];
  if (lead.gsId || lead.abn) return 'Find the right program contact and ask what can be shared publicly.';
  return 'Resolve the ABN/legal entity first, then find the right program contact.';
}

function contactText(lead: QldAnnouncementProviderLead) {
  const parts = [
    lead.contactEmail ? `Email: ${lead.contactEmail}` : null,
    lead.contactPhone ? `Phone: ${lead.contactPhone}` : null,
    lead.website ? `Website: ${lead.website}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'No public contact saved yet';
}

function leadCopyText(lead: QldAnnouncementProviderLead) {
  const isSystemActor = lead.entityStatus === 'system-actor';
  return [
    lead.name,
    lead.abn ? `ABN: ${lead.abn}` : isSystemActor ? 'ABN: not applicable until provider is named' : 'ABN: unresolved',
    lead.gsId ? `CivicGraph: ${lead.gsId}` : isSystemActor ? 'CivicGraph: not applicable until provider is named' : 'CivicGraph: unresolved',
    `Status: ${entityStatusLabel(lead)}`,
    `Source: ${lead.source}`,
    `What we know: ${lead.role}`,
    `Contact: ${contactText(lead)}`,
    `Outreach: ${outreachMove(lead)}`,
  ].join('\n');
}

export async function generateMetadata({ params }: { params: Promise<{ announcementSlug: string }> }) {
  const { announcementSlug } = await params;
  const announcement = getQldAnnouncement(announcementSlug);
  if (!announcement) return { title: 'Announcement not found' };
  return {
    title: `${announcement.title} — QLD Youth Justice Announcement`,
    description: announcement.summary,
  };
}

export default async function QldYouthJusticeAnnouncementPage({
  params,
}: {
  params: Promise<{ announcementSlug: string }>;
}) {
  const { announcementSlug } = await params;
  const announcement = getQldAnnouncement(announcementSlug);
  if (!announcement) notFound();

  const organisationLeads = announcement.providerLeads.filter((lead) => lead.entityStatus !== 'system-actor');
  const linkedEntityLeads = organisationLeads.filter((lead) => lead.gsId || lead.abn).length;
  const unresolvedLeads = organisationLeads.length - linkedEntityLeads;
  const systemActorLeads = announcement.providerLeads.length - organisationLeads.length;
  const needsContactLeads = organisationLeads.filter((lead) => !lead.contactEmail && !lead.contactPhone && !lead.website).length;
  const outreachSubject = `JusticeHub conversation: ${announcement.title}`;
  const emailText = [
    `Subject: ${outreachSubject}`,
    '',
    `Hi, we are building JusticeHub as a public evidence layer for youth justice reform in Queensland. Your organisation appears in the public record for ${announcement.title}.`,
    '',
    'We are not asking for private case data. We are trying to confirm the program contact, what work is being delivered, and what evidence or story can be shared safely.',
    '',
    'Could you point us to the right person for a short conversation?',
  ].join('\n');
  const tableCopyText = [
    ['Organisation', 'ABN', 'CivicGraph ID', 'Status', 'Source', 'What we know', 'Contact', 'Outreach move'].join('\t'),
    ...announcement.providerLeads.map((lead) => [
      lead.name,
      lead.abn ?? '',
      lead.gsId ?? '',
      entityStatusLabel(lead),
      lead.source,
      lead.role,
      contactText(lead),
      outreachMove(lead),
    ].join('\t')),
  ].join('\n');

  return (
    <div className="w-full max-w-none">
      <section className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <Link
            href="/reports/youth-justice/qld/announcements"
            className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
          >
            &larr; All QLD announcements
          </Link>
          <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Organisation contact board</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${qldAnnouncementStatusClass(announcement.status)}`}>
              {qldAnnouncementStatusLabel(announcement.status)}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{announcement.sourceLabel}</span>
          </div>
          <h1 className="mt-3 text-3xl font-black text-bauhaus-black sm:text-4xl">{announcement.title}</h1>
          <p className="mt-3 max-w-5xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
            {announcement.summary}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 self-start">
          <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
            <div className="text-2xl font-black text-bauhaus-black">{fmt(announcement.providerLeads.length)}</div>
            <div className="mt-1 text-xs text-bauhaus-muted">names to work</div>
          </div>
          <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
            <div className="text-2xl font-black text-emerald-700">{fmt(linkedEntityLeads)}</div>
            <div className="mt-1 text-xs text-bauhaus-muted">known entities</div>
          </div>
          <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
            <div className="text-2xl font-black text-amber-700">{fmt(needsContactLeads)}</div>
            <div className="mt-1 text-xs text-bauhaus-muted">need contact path</div>
          </div>
          <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
            <div className="text-2xl font-black text-bauhaus-black">{fmt(announcement.sourceLinks.length)}</div>
            <div className="mt-1 text-xs text-bauhaus-muted">source links</div>
          </div>
        </div>
      </section>

      {announcement.publicBrief && (
        <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="border-4 border-bauhaus-black bg-white p-6">
            <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-red">Public read</div>
            <h2 className="text-2xl font-black text-bauhaus-black">{announcement.publicBrief.headline}</h2>
            <p className="mt-3 max-w-5xl text-sm leading-relaxed text-bauhaus-muted">
              {announcement.publicBrief.intro}
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {announcement.publicBrief.readerNotes.map((note) => (
                <div key={note} className="border-2 border-gray-200 bg-bauhaus-canvas p-4 text-sm leading-relaxed text-bauhaus-muted">
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
            <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-blue">What to collect</div>
            <ul className="space-y-3 text-sm leading-relaxed text-bauhaus-muted">
              {announcement.publicBrief.usefulInformation.map((item) => (
                <li key={item} className="border-l-4 border-bauhaus-blue pl-3">{item}</li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              {announcement.publicBrief.civicLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  className="border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                  title={link.note}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mb-8 border-4 border-bauhaus-black bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-red">Organisations</div>
            <h2 className="text-2xl font-black text-bauhaus-black">Who we need to know and contact</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
              Keep this simple: name, CivicGraph entity, public contact path, and the next outreach move.
            </p>
          </div>
          <CopyButton text={tableCopyText} label="Copy table" />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                <th className="py-3 pr-4">Organisation / service</th>
                <th className="px-4 py-3">Known?</th>
                <th className="px-4 py-3">What we know</th>
                <th className="px-4 py-3">How to reach out</th>
                <th className="py-3 pl-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {announcement.providerLeads.map((lead) => {
                const href = entityHref(lead);
                return (
                  <tr key={`${lead.name}-${lead.role}`} className="border-b border-gray-200 align-top">
                    <td className="py-4 pr-4">
                      <div className="font-black text-bauhaus-black">{lead.name}</div>
                      <div className="mt-1 text-xs text-bauhaus-muted">{lead.source}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${entityStatusClass(lead)}`}>
                        {entityStatusLabel(lead)}
                      </span>
                      {lead.abn && <div className="mt-2 font-mono text-[11px] text-bauhaus-muted">ABN {lead.abn}</div>}
                    </td>
                    <td className="px-4 py-4 text-bauhaus-muted">
                      <div>{lead.role}</div>
                      {lead.gsId && <div className="mt-1 font-mono text-[11px]">GS {lead.gsId}</div>}
                    </td>
                    <td className="px-4 py-4 text-bauhaus-muted">
                      <div className="space-y-1 text-xs">
                        {lead.contactEmail && (
                          <a href={`mailto:${lead.contactEmail}`} className="block font-black text-bauhaus-blue hover:underline">
                            {lead.contactEmail}
                          </a>
                        )}
                        {lead.contactPhone && <div className="font-mono text-bauhaus-black">{lead.contactPhone}</div>}
                        {lead.website && (
                          <a href={lead.website} className="block font-black text-bauhaus-blue hover:underline">
                            Website
                          </a>
                        )}
                        {!lead.contactEmail && !lead.contactPhone && !lead.website && (
                          <div className="font-black uppercase tracking-wider text-amber-700">Find contact</div>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-relaxed">{outreachMove(lead)}</p>
                    </td>
                    <td className="py-4 pl-4">
                      {href ? (
                        <Link
                          href={href}
                          className="inline-block border-2 border-bauhaus-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
                        >
                          Open entity
                        </Link>
                      ) : lead.entityStatus === 'system-actor' ? (
                        <Link
                          href="/reports/youth-justice/qld/trackers"
                          className="inline-block border-2 border-gray-400 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-700 hover:bg-gray-100"
                        >
                          Map providers
                        </Link>
                      ) : (
                        <Link
                          href="/entity"
                          className="inline-block border-2 border-amber-400 bg-amber-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-amber-800 hover:bg-amber-100"
                        >
                          Resolve ABN
                        </Link>
                      )}
                      <div className="mt-2">
                        <CopyButton text={leadCopyText(lead)} label="Copy row" className="border-gray-300" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-red">Reach out</div>
              <h2 className="text-2xl font-black text-bauhaus-black">Short email starter</h2>
            </div>
            <CopyButton text={emailText} label="Copy email" />
          </div>
          <div className="mt-4 border-2 border-gray-200 bg-white p-4 text-sm leading-relaxed text-bauhaus-muted">
            <div className="font-black text-bauhaus-black">Subject: {outreachSubject}</div>
            <p className="mt-3">
              Hi, we are building JusticeHub as a public evidence layer for youth justice reform in Queensland. Your organisation appears in the public record for {announcement.title}.
            </p>
            <p className="mt-3">
              We are not asking for private case data. We are trying to confirm the program contact, what work is being delivered, and what evidence or story can be shared safely.
            </p>
            <p className="mt-3">
              Could you point us to the right person for a short conversation?
            </p>
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-red">Admin next</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Do this next</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-bauhaus-muted">
            <li className="border-l-4 border-bauhaus-blue pl-3">
              {unresolvedLeads > 0
                ? `Resolve the ${fmt(unresolvedLeads)} names without ABNs.`
                : needsContactLeads > 0
                  ? `All current organisation names have an ABN. Add contact paths for the ${fmt(needsContactLeads)} rows still missing one.`
                  : `All current organisation names have ABNs and contact paths. ${systemActorLeads > 0 ? `Map the ${fmt(systemActorLeads)} system placeholders to named providers next.` : 'Start outreach from the rows above.'}`}
            </li>
            <li className="border-l-4 border-bauhaus-blue pl-3">Add the right person, email, and response status in GHL or the tracker.</li>
            <li className="border-l-4 border-bauhaus-blue pl-3">Keep public data, sensitive data, and consent-held story material separate.</li>
          </ul>
        </div>
      </section>

      <section className="mb-8 border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-red">Source links</div>
        <h2 className="text-2xl font-black text-bauhaus-black">Where the names came from</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {announcement.sourceLinks.map((source) => (
            <a
              key={`${source.label}-${source.url}`}
              href={source.url}
              className="border-2 border-gray-200 bg-white p-4 transition-colors hover:border-bauhaus-blue hover:bg-blue-50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">
                  {source.kind}
                </span>
                <span className="text-sm font-black text-bauhaus-blue">{source.label}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-bauhaus-muted">{source.note}</p>
            </a>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/reports/youth-justice/qld"
          className="border-2 border-bauhaus-black bg-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-white hover:text-bauhaus-black"
        >
          Back to QLD ledger
        </Link>
        <Link
          href="/reports/youth-justice/qld/announcements"
          className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-wider text-bauhaus-black hover:bg-bauhaus-black hover:text-white"
        >
          All announcements
        </Link>
      </div>
    </div>
  );
}

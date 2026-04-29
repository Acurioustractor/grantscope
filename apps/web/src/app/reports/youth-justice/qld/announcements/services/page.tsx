import Link from 'next/link';
import { fmt, money } from '@/lib/services/report-service';
import {
  type QldAnnouncement,
  type QldAnnouncementProviderLead,
  qldAnnouncementStatusClass,
  qldAnnouncementStatusLabel,
  qldYouthJusticeAnnouncements,
} from '@/lib/reports/qld-youth-justice-announcements';

export const revalidate = 3600;

export const metadata = {
  title: 'QLD Youth Justice Supplier and Service Map — CivicGraph',
  description: 'A cross-announcement map of QLD youth justice suppliers, service leads, ABNs, contacts, and initiative overlaps.',
};

type LeadStatus = NonNullable<QldAnnouncementProviderLead['entityStatus']>;

type LeadInstance = {
  announcementTitle: string;
  announcementSlug: string;
  announcementStatus: QldAnnouncement['status'];
  amountLabel: string;
  serviceAreas: string[];
  lead: QldAnnouncementProviderLead;
};

type SupplierGroup = {
  key: string;
  name: string;
  abn?: string;
  gsId?: string;
  entityStatus: LeadStatus;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  instances: LeadInstance[];
  serviceAreas: string[];
  sources: string[];
  knownFacts: string[];
  askNext: string[];
};

type ServiceSupplierRef = {
  key: string;
  name: string;
  href: string | null;
  status: LeadStatus;
  firstAnnouncementSlug: string;
};

type ServiceRow = {
  service: string;
  announcements: Set<string>;
  suppliers: Map<string, ServiceSupplierRef>;
  unresolved: number;
};

function normaliseName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function leadKey(lead: QldAnnouncementProviderLead) {
  if (lead.abn) return `abn:${lead.abn}`;
  if (lead.gsId) return `gs:${lead.gsId}`;
  return `name:${normaliseName(lead.name)}`;
}

function leadEntityStatus(lead: QldAnnouncementProviderLead): LeadStatus {
  return lead.entityStatus ?? (lead.gsId || lead.abn ? 'linked' : 'needs-confirmation');
}

function leadStatusLabel(status: LeadStatus) {
  const labels: Record<LeadStatus, string> = {
    linked: 'Known entity',
    'likely-match': 'Likely match',
    'needs-abn': 'Needs ABN',
    'needs-contact': 'Needs contact',
    'needs-confirmation': 'Needs confirmation',
    'system-actor': 'System / unresolved',
  };
  return labels[status];
}

function leadStatusClass(status: LeadStatus) {
  const styles: Record<LeadStatus, string> = {
    linked: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    'likely-match': 'border-blue-300 bg-blue-50 text-blue-800',
    'needs-abn': 'border-amber-300 bg-amber-50 text-amber-800',
    'needs-contact': 'border-amber-300 bg-amber-50 text-amber-800',
    'needs-confirmation': 'border-amber-300 bg-amber-50 text-amber-800',
    'system-actor': 'border-gray-300 bg-gray-50 text-gray-700',
  };
  return styles[status];
}

function entityHref(group: SupplierGroup) {
  if (group.gsId) return `/entity/${encodeURIComponent(group.gsId)}`;
  if (group.abn) return `/entity/AU-ABN-${encodeURIComponent(group.abn)}`;
  return null;
}

function uniqueValues(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function buildSupplierGroups() {
  const groups = new Map<string, SupplierGroup>();

  qldYouthJusticeAnnouncements.forEach((announcement) => {
    announcement.providerLeads.forEach((lead) => {
      const key = leadKey(lead);
      const status = leadEntityStatus(lead);
      const current = groups.get(key);
      const instance: LeadInstance = {
        announcementTitle: announcement.title,
        announcementSlug: announcement.slug,
        announcementStatus: announcement.status,
        amountLabel: announcement.amountLabel,
        serviceAreas: announcement.serviceAreas,
        lead,
      };

      if (!current) {
        groups.set(key, {
          key,
          name: lead.name,
          abn: lead.abn,
          gsId: lead.gsId,
          entityStatus: status,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          website: lead.website,
          instances: [instance],
          serviceAreas: [...announcement.serviceAreas],
          sources: [lead.source],
          knownFacts: lead.knownFacts ?? [],
          askNext: lead.askNext ?? [],
        });
        return;
      }

      current.instances.push(instance);
      current.abn = current.abn ?? lead.abn;
      current.gsId = current.gsId ?? lead.gsId;
      current.contactEmail = current.contactEmail ?? lead.contactEmail;
      current.contactPhone = current.contactPhone ?? lead.contactPhone;
      current.website = current.website ?? lead.website;
      current.serviceAreas = uniqueValues([...current.serviceAreas, ...announcement.serviceAreas]);
      current.sources = uniqueValues([...current.sources, lead.source]);
      current.knownFacts = uniqueValues([...current.knownFacts, ...(lead.knownFacts ?? [])]);
      current.askNext = uniqueValues([...current.askNext, ...(lead.askNext ?? [])]);
      if (current.entityStatus === 'system-actor' && status !== 'system-actor') {
        current.entityStatus = status;
      }
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    const repeatedDelta = Number(b.instances.length > 1) - Number(a.instances.length > 1);
    if (repeatedDelta) return repeatedDelta;
    const knownDelta = Number(b.entityStatus === 'linked') - Number(a.entityStatus === 'linked');
    if (knownDelta) return knownDelta;
    return a.name.localeCompare(b.name);
  });
}

function buildServiceRows(groups: SupplierGroup[]) {
  const services = new Map<string, ServiceRow>();

  groups.forEach((group) => {
    group.instances.forEach((instance) => {
      instance.serviceAreas.forEach((service) => {
        const row = services.get(service) ?? {
          service,
          announcements: new Set<string>(),
          suppliers: new Map<string, ServiceSupplierRef>(),
          unresolved: 0,
        };
        row.announcements.add(instance.announcementTitle);
        row.suppliers.set(group.key, {
          key: group.key,
          name: group.name,
          href: entityHref(group),
          status: group.entityStatus,
          firstAnnouncementSlug: instance.announcementSlug,
        });
        if (group.entityStatus !== 'linked') row.unresolved += 1;
        services.set(service, row);
      });
    });
  });

  return Array.from(services.values()).sort((a, b) => {
    const announcementDelta = b.announcements.size - a.announcements.size;
    if (announcementDelta) return announcementDelta;
    return a.service.localeCompare(b.service);
  });
}

export default function QldYouthJusticeAnnouncementServicesPage() {
  const groups = buildSupplierGroups();
  const serviceRows = buildServiceRows(groups);
  const organisationGroups = groups.filter((group) => group.entityStatus !== 'system-actor');
  const systemGroups = groups.filter((group) => group.entityStatus === 'system-actor');
  const linkedGroups = organisationGroups.filter((group) => group.abn || group.gsId);
  const repeatedGroups = groups.filter((group) => group.instances.length > 1);
  const contactableGroups = groups.filter((group) => group.contactEmail || group.contactPhone || group.website);
  const announcedTotal = qldYouthJusticeAnnouncements.reduce((sum, item) => sum + item.amountValue, 0);

  return (
    <div className="w-full max-w-none">
      <div className="mb-8">
        <Link
          href="/reports/youth-justice/qld/announcements"
          className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black"
        >
          &larr; QLD announcement register
        </Link>
        <div className="mb-1 mt-4 text-xs font-black uppercase tracking-widest text-bauhaus-red">Supplier and service map</div>
        <h1 className="text-3xl font-black text-bauhaus-black sm:text-4xl">Who is connected to each initiative</h1>
        <p className="mt-3 max-w-5xl text-base font-medium leading-relaxed text-bauhaus-muted sm:text-lg">
          This flips the QLD announcement register around. Instead of starting with government promises, it starts with
          suppliers, service leads, ABNs, contacts, and service lanes so overlaps across initiatives are visible.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-black">{fmt(groups.length)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">unique names</div>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-emerald-700">{fmt(linkedGroups.length)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">with ABN/entity</div>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-blue">{fmt(repeatedGroups.length)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">overlap names</div>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-red">{fmt(systemGroups.length)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">to resolve</div>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-black">{fmt(contactableGroups.length)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">contact paths</div>
        </div>
        <div className="border-2 border-bauhaus-black bg-white p-5 text-center">
          <div className="text-2xl font-black text-bauhaus-black">{money(announcedTotal)}</div>
          <div className="mt-1 text-xs text-bauhaus-muted">announcement pool</div>
        </div>
      </div>

      <section className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-red">Overlap watchlist</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Names appearing across more than one initiative</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {repeatedGroups.map((group) => {
              const href = entityHref(group);
              return (
                <div key={group.key} className="border-2 border-gray-200 bg-bauhaus-canvas p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {href ? (
                      <Link href={href} className="font-black text-bauhaus-blue hover:underline">
                        {group.name}
                      </Link>
                    ) : (
                      <Link
                        href={`/reports/youth-justice/qld/announcements/${group.instances[0].announcementSlug}`}
                        className="font-black text-bauhaus-black hover:text-bauhaus-blue hover:underline"
                      >
                        {group.name}
                      </Link>
                    )}
                    <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${leadStatusClass(group.entityStatus)}`}>
                      {leadStatusLabel(group.entityStatus)}
                    </span>
                  </div>
                  {group.abn && <div className="mt-1 font-mono text-[11px] text-bauhaus-muted">ABN {group.abn}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uniqueValues(group.instances.map((item) => item.announcementTitle)).map((title) => (
                      <span key={title} className="border border-gray-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                        {title}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {href && (
                      <Link href={href} className="text-xs font-black uppercase tracking-wider text-bauhaus-blue hover:underline">
                        Open entity
                      </Link>
                    )}
                    <Link href={`/reports/youth-justice/qld/announcements/${group.instances[0].announcementSlug}`} className="text-xs font-black uppercase tracking-wider text-bauhaus-blue hover:underline">
                      Open first initiative
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6">
          <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-blue">How to use</div>
          <h2 className="text-2xl font-black text-bauhaus-black">Turn names into a delivery graph</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-bauhaus-muted">
            <li className="border-l-4 border-bauhaus-blue pl-3">Start with overlap names. They are the fastest way to see who may sit across multiple government initiatives.</li>
            <li className="border-l-4 border-bauhaus-blue pl-3">Resolve every unresolved system actor into a named department unit, provider, location, ABN, contract, or evidence source.</li>
            <li className="border-l-4 border-bauhaus-blue pl-3">Use the service lane table to find where different announcements are funding the same kind of work.</li>
            <li className="border-l-4 border-bauhaus-blue pl-3">Move contactable suppliers into GHL or the tracker only when there is a clear next question.</li>
          </ul>
        </div>
      </section>

      <section className="mb-8 border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-red">Service lanes</div>
        <h2 className="text-2xl font-black text-bauhaus-black">Where initiatives overlap by service type</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                <th className="w-[18%] py-3 pr-4">Service lane</th>
                <th className="w-[10%] px-4 py-3">Initiatives</th>
                <th className="w-[62%] px-4 py-3">Names touching lane</th>
                <th className="w-[10%] py-3 pl-4">Unresolved</th>
              </tr>
            </thead>
            <tbody>
              {serviceRows.map((row) => (
                <tr key={row.service} className="border-b border-gray-200 align-top">
                  <td className="py-4 pr-4 font-black text-bauhaus-black">{row.service}</td>
                  <td className="px-4 py-4 text-bauhaus-muted">{fmt(row.announcements.size)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {Array.from(row.suppliers.values()).map((supplier) => (
                        <Link
                          key={supplier.key}
                          href={supplier.href ?? `/reports/youth-justice/qld/announcements/${supplier.firstAnnouncementSlug}`}
                          className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:border-bauhaus-blue hover:bg-blue-50 hover:text-bauhaus-blue ${
                            supplier.href ? 'border-gray-300 bg-white text-bauhaus-black' : 'border-gray-200 bg-gray-50 text-bauhaus-muted'
                          }`}
                          title={supplier.href ? 'Open CivicGraph entity map' : 'Open source initiative to resolve this name'}
                        >
                          {supplier.name}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 pl-4 font-black text-bauhaus-red">{fmt(row.unresolved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-4 border-bauhaus-black bg-white p-6">
        <div className="mb-1 text-xs font-black uppercase tracking-widest text-bauhaus-red">Full register</div>
        <h2 className="text-2xl font-black text-bauhaus-black">All suppliers, services, and placeholders</h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-bauhaus-muted">
          This table keeps real organisations and unresolved delivery placeholders together. That is deliberate: the gap
          between a named announcement and a named supplier is the accountability work.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                <th className="w-[24%] py-3 pr-4">Supplier / service lead</th>
                <th className="w-[13%] px-4 py-3">Status</th>
                <th className="w-[18%] px-4 py-3">Initiatives</th>
                <th className="w-[22%] px-4 py-3">Services</th>
                <th className="w-[23%] py-3 pl-4">Contact / next question</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const href = entityHref(group);
                const firstInstance = group.instances[0];
                const contact = group.contactEmail ?? group.contactPhone ?? group.website;
                return (
                  <tr key={group.key} className="border-b border-gray-200 align-top">
                    <td className="py-4 pr-4">
                      {href ? (
                        <Link href={href} className="block font-black text-bauhaus-blue hover:underline">
                          {group.name}
                        </Link>
                      ) : (
                        <Link
                          href={`/reports/youth-justice/qld/announcements/${firstInstance.announcementSlug}`}
                          className="block font-black text-bauhaus-black hover:text-bauhaus-blue hover:underline"
                        >
                          {group.name}
                        </Link>
                      )}
                      {group.abn && <div className="mt-1 font-mono text-[11px] text-bauhaus-muted">ABN {group.abn}</div>}
                      {group.gsId && <div className="mt-1 font-mono text-[11px] text-bauhaus-muted">{group.gsId}</div>}
                      <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">
                        {href ? 'Open CivicGraph map' : 'Resolve from initiative'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${leadStatusClass(group.entityStatus)}`}>
                        {leadStatusLabel(group.entityStatus)}
                      </span>
                      <div className="mt-2 text-xs text-bauhaus-muted">{fmt(group.instances.length)} initiative touch{group.instances.length === 1 ? '' : 'es'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {group.instances.map((instance) => (
                          <Link
                            key={`${group.key}-${instance.announcementSlug}`}
                            href={`/reports/youth-justice/qld/announcements/${instance.announcementSlug}`}
                            className="block border border-gray-200 bg-gray-50 px-2 py-2 hover:border-bauhaus-blue hover:bg-blue-50"
                          >
                            <div className="font-black text-bauhaus-black">{instance.announcementTitle}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={`border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${qldAnnouncementStatusClass(instance.announcementStatus)}`}>
                                {qldAnnouncementStatusLabel(instance.announcementStatus)}
                              </span>
                              <span className="text-[10px] text-bauhaus-muted">{instance.amountLabel}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {group.serviceAreas.slice(0, 7).map((service) => (
                          <span key={service} className="border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-muted">
                            {service}
                          </span>
                        ))}
                        {group.serviceAreas.length > 7 && <span className="text-xs font-black text-bauhaus-muted">+{fmt(group.serviceAreas.length - 7)} more</span>}
                      </div>
                    </td>
                    <td className="py-4 pl-4 text-bauhaus-muted">
                      {contact ? (
                        <div className="space-y-1 text-xs">
                          {group.contactEmail && <a href={`mailto:${group.contactEmail}`} className="block font-black text-bauhaus-blue hover:underline">{group.contactEmail}</a>}
                          {group.contactPhone && <div className="font-mono text-bauhaus-black">{group.contactPhone}</div>}
                          {group.website && <a href={group.website} className="block font-black text-bauhaus-blue hover:underline">Website</a>}
                        </div>
                      ) : (
                        <div className="text-xs font-black uppercase tracking-wider text-amber-700">No contact path yet</div>
                      )}
                      <p className="mt-3 text-sm leading-relaxed">
                        {group.askNext[0] ?? firstInstance.lead.outreachAngle ?? 'Resolve the entity, contact path, delivery role, and public evidence trail.'}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

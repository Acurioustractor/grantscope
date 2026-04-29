import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getOrgProfileBySlug,
  getOrgContacts,
} from '@/lib/services/org-dashboard-service';
import { ContactsClient } from './contacts-client';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getOrgProfileBySlug(slug);
  if (!profile) return { title: 'Not Found — CivicGraph' };
  return {
    title: `Contacts — ${profile.name} — CivicGraph`,
    description: `Contact network for ${profile.name}`,
  };
}

export default async function ContactsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const includeGhl = slug === 'act' || slug === 'a-curious-tractor';
  const contacts = await getOrgContacts(profile.id, undefined, { includeGhl });

  // Count by type
  const typeCounts: Record<string, number> = {};
  for (const c of contacts) {
    typeCounts[c.contact_type] = (typeCounts[c.contact_type] || 0) + 1;
  }

  const linkedCount = contacts.filter(c => c.linked_entity_gs_id).length;
  const personCount = contacts.filter(c => c.person_id).length;
  const emailCount = contacts.filter(c => c.email).length;
  const ghlCount = contacts.filter(c => c.ghl_contact_id).length;
  const crmCount = contacts.filter(c => c.source_system === 'ghl').length;
  const civicGraphCount = contacts.filter(c => c.source_system === 'civicgraph').length;
  const notionCount = contacts.filter(c => c.notion_id).length;
  const taggedCount = contacts.filter(c => c.unified_tags?.length > 0).length;

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-blue mb-1">
                <Link href={`/org/${slug}`} className="hover:text-white transition-colors">
                  {profile.name}
                </Link>
                {' '}&rarr; Contacts
              </p>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                Partner Network
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                {civicGraphCount} relationship contacts
                {crmCount > 0 && <> &middot; {crmCount} CRM contacts</>}
                {' '}&middot; {emailCount} with email &middot; {personCount} linked to people &middot; {linkedCount} linked to entities
                {ghlCount > 0 && <> &middot; {ghlCount} in GHL</>}
                {notionCount > 0 && <> &middot; {notionCount} in Notion</>}
                {taggedCount > 0 && <> &middot; {taggedCount} tagged</>}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Link
                href={`/org/${slug}`}
                className="text-sm text-gray-400 hover:text-white underline"
              >
                &larr; Dashboard
              </Link>
            </div>
          </div>

          {/* Type breakdown chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <span
                key={type}
                className="text-[10px] px-2.5 py-1 font-bold uppercase tracking-wider bg-white/10 text-white rounded-sm"
              >
                {type} ({count})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <ContactsClient
          contacts={contacts}
          orgProfileId={profile.id}
          orgSlug={slug}
        />
      </div>
    </main>
  );
}

import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { UploadForm } from './upload-form';
import { DocumentList } from './document-list';
import { KnowledgeChat } from './knowledge-chat';

export const metadata = {
  title: 'Knowledge Wiki — CivicGraph',
};

export default async function KnowledgePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-widest text-bauhaus-black">
          Knowledge Wiki
        </h1>
        <p className="text-bauhaus-muted font-medium mt-2">
          Upload documents to build your organisation&apos;s knowledge base. Ask questions about your uploaded content.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-4">
              Upload Documents
            </h2>
            <UploadForm />
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-4">
              Your Documents
            </h2>
            <DocumentList />
          </section>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-black mb-4">
              Ask Your Knowledge
            </h2>
            <KnowledgeChat />
          </div>
        </div>
      </div>
    </main>
  );
}

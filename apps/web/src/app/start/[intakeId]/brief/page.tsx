import { getIntake, generateBrief } from '@/lib/services/intake-service';
import { notFound } from 'next/navigation';
import { PrintButton } from './print-button';

type Props = { params: Promise<{ intakeId: string }> };

export default async function BriefPage({ params }: Props) {
  const { intakeId } = await params;
  const intake = await getIntake(intakeId);
  if (!intake) notFound();

  const brief = generateBrief(intake);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-4 border-bauhaus-black px-6 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <a href="/start" className="text-sm font-black uppercase tracking-widest text-bauhaus-black hover:text-gray-600 transition-colors">
            CivicGraph
          </a>
          <span className="text-gray-300">|</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Project Brief</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/start/${intakeId}`}
            className="text-xs font-bold text-gray-500 hover:text-bauhaus-black transition-colors"
          >
            Back to conversation
          </a>
          <PrintButton />
        </div>
      </header>

      {/* Brief content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <article className="prose prose-sm max-w-none
          prose-headings:font-black prose-headings:uppercase prose-headings:tracking-wider prose-headings:text-bauhaus-black
          prose-h1:text-2xl prose-h1:border-b-4 prose-h1:border-bauhaus-black prose-h1:pb-3
          prose-h2:text-lg prose-h2:mt-8
          prose-strong:text-bauhaus-black
          prose-p:text-gray-700 prose-p:leading-relaxed
          prose-li:text-gray-700
          prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:text-gray-700
        ">
          <BriefContent markdown={brief} />
        </article>
      </main>
    </div>
  );
}

function BriefContent({ markdown }: { markdown: string }) {
  // Simple markdown-to-JSX for the brief (server component, no client JS needed)
  const sections = markdown.split('\n\n');

  return (
    <>
      {sections.map((section, i) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('# ')) {
          return <h1 key={i}>{trimmed.slice(2)}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={i}>{trimmed.slice(3)}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={i}>{trimmed.slice(4)}</h3>;
        }
        if (trimmed.startsWith('- ')) {
          const items = trimmed.split('\n').filter(l => l.startsWith('- '));
          return (
            <ul key={i}>
              {items.map((item, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: formatInline(item.slice(2)) }} />
              ))}
            </ul>
          );
        }
        if (trimmed.startsWith('```')) {
          const lines = trimmed.split('\n');
          const code = lines.slice(1, -1).join('\n');
          return <pre key={i}><code>{code}</code></pre>;
        }
        if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
          return <p key={i} className="text-xs text-gray-400 italic">{trimmed.slice(1, -1)}</p>;
        }
        if (trimmed.startsWith('---')) {
          return <hr key={i} className="border-t-2 border-gray-200 my-8" />;
        }

        return <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />;
      })}
    </>
  );
}

function formatInline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

import { getIntake, getIntakeMessages } from '@/lib/services/intake-service';
import { notFound } from 'next/navigation';
import { IntakeBuilderClient } from './intake-builder-client';

type Props = { params: Promise<{ intakeId: string }> };

export default async function IntakePage({ params }: Props) {
  const { intakeId } = await params;
  const intake = await getIntake(intakeId);
  if (!intake) notFound();

  const dbMessages = await getIntakeMessages(intakeId);
  const savedMessages = dbMessages.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b-4 border-bauhaus-black px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <a href="/start" className="text-sm font-black uppercase tracking-widest text-bauhaus-black hover:text-gray-600 transition-colors">
            CivicGraph
          </a>
          <span className="text-gray-300">|</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Innovation Guide</span>
        </div>
        {intake.idea_summary && (
          <span className="text-xs text-gray-500 truncate max-w-xs hidden md:block">
            {intake.idea_summary}
          </span>
        )}
      </header>

      {/* Main content */}
      <IntakeBuilderClient
        intakeId={intakeId}
        initialPhase={intake.phase}
        savedMessages={savedMessages}
      />
    </div>
  );
}

'use client';

import type { JourneyPersonaWithSteps } from '@/lib/services/journey-service';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// System colors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SYSTEM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  education: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  justice: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  'child-protection': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  health: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  housing: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  disability: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300' },
  'family-services': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-300' },
  community: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300' },
  economic: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
};

const EMOTION_ICONS: Record<string, string> = {
  scared: '😨', hopeful: '🌟', isolated: '🫥', confused: '😕', angry: '😡',
  resigned: '😔', safe: '🛡️', connected: '🤝', proud: '💪', healing: '💚',
  'cautious hope': '🌱', supported: '🫶', empowered: '✊', anxious: '😰',
};

function SystemBadge({ system }: { system: string }) {
  const colors = SYSTEM_COLORS[system] ?? { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-300' };
  return (
    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider border rounded-sm ${colors.bg} ${colors.text} ${colors.border}`}>
      {system}
    </span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Step Node
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StepNode({ step, isCurrent }: {
  step: JourneyPersonaWithSteps['steps'][number];
  isCurrent: boolean;
}) {
  const emotionIcon = step.emotion ? EMOTION_ICONS[step.emotion] ?? '•' : '';

  return (
    <div className={`relative flex flex-col items-center min-w-[140px] max-w-[180px] ${step.is_divergence_point ? 'ring-2 ring-bauhaus-red ring-offset-2 rounded-lg' : ''}`}>
      {/* Icon */}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl
        ${isCurrent ? 'bg-red-100 border-2 border-red-400' : 'bg-emerald-100 border-2 border-emerald-400'}`}>
        {step.icon || (isCurrent ? '🔴' : '🟢')}
      </div>

      {/* Title */}
      <p className="text-xs font-bold text-center mt-2 leading-tight">{step.title}</p>

      {/* System badge */}
      {step.system && (
        <div className="mt-1">
          <SystemBadge system={step.system} />
        </div>
      )}

      {/* Emotion */}
      {step.emotion && (
        <p className="text-[10px] text-gray-500 mt-1">
          {emotionIcon} {step.emotion}
        </p>
      )}

      {/* Duration */}
      {step.duration && (
        <p className="text-[10px] text-gray-400 mt-0.5">{step.duration}</p>
      )}

      {/* Divergence marker */}
      {step.is_divergence_point && (
        <div className="absolute -top-2 -right-2 bg-bauhaus-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
          SPLIT
        </div>
      )}

      {/* Data matches */}
      {step.matches.length > 0 && (
        <div className="mt-2 space-y-1">
          {step.matches.map(m => (
            <div key={m.id} className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-[9px]">
              <p className="font-bold text-amber-800">{m.match_name}</p>
              {m.match_detail && <p className="text-amber-600 line-clamp-2">{m.match_detail}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Persona Journey Path
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PersonaPath({ persona }: { persona: JourneyPersonaWithSteps }) {
  const currentSteps = persona.steps
    .filter(s => s.path === 'current')
    .sort((a, b) => a.step_number - b.step_number);
  const alternativeSteps = persona.steps
    .filter(s => s.path === 'alternative')
    .sort((a, b) => a.step_number - b.step_number);

  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
      {/* Persona header */}
      <div className="mb-6">
        <h3 className="text-lg font-black uppercase tracking-wider text-bauhaus-black">
          {persona.label}
        </h3>
        {persona.description && (
          <p className="text-sm text-gray-600 mt-1">{persona.description}</p>
        )}
        <div className="flex gap-3 mt-2 text-xs text-gray-400">
          {persona.cohort && <span>Cohort: {persona.cohort}</span>}
          {persona.context && <span>Context: {persona.context}</span>}
        </div>
      </div>

      {/* Current path */}
      {currentSteps.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-red-600">Current Journey</p>
          </div>
          <div className="flex items-start gap-2 overflow-x-auto pb-4">
            {currentSteps.map((step, i) => (
              <div key={step.id} className="flex items-start">
                <StepNode step={step} isCurrent={true} />
                {i < currentSteps.length - 1 && (
                  <div className="flex items-center self-center mt-6 px-1">
                    <div className="w-8 h-0.5 bg-red-300" />
                    <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-red-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternative path */}
      {alternativeSteps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Alternative Journey</p>
          </div>
          <div className="flex items-start gap-2 overflow-x-auto pb-4">
            {alternativeSteps.map((step, i) => (
              <div key={step.id} className="flex items-start">
                <StepNode step={step} isCurrent={false} />
                {i < alternativeSteps.length - 1 && (
                  <div className="flex items-center self-center mt-6 px-1">
                    <div className="w-8 h-0.5 bg-emerald-300" />
                    <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-emerald-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {currentSteps.length === 0 && alternativeSteps.length === 0 && (
        <p className="text-sm text-gray-400 italic">No steps mapped yet. Keep talking to the guide to build this journey.</p>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Journey Map
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function JourneyMap({
  title,
  personas,
  activePersonaId,
  onSelectPersona,
  compact,
}: {
  title: string;
  personas: JourneyPersonaWithSteps[];
  activePersonaId?: string;
  onSelectPersona?: (id: string) => void;
  compact?: boolean;
}) {
  const displayPersonas = activePersonaId
    ? personas.filter(p => p.id === activePersonaId)
    : personas;

  return (
    <div className={compact ? '' : 'space-y-6'}>
      {/* Title */}
      {!compact && (
        <h2 className="text-xl font-black uppercase tracking-wider text-bauhaus-black">
          {title}
        </h2>
      )}

      {/* Persona tabs */}
      {personas.length > 1 && onSelectPersona && (
        <div className="flex gap-2 border-b border-gray-200 pb-2">
          <button
            onClick={() => onSelectPersona('')}
            className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-t transition-colors
              ${!activePersonaId ? 'bg-bauhaus-black text-white' : 'text-gray-500 hover:text-bauhaus-black'}`}
          >
            All
          </button>
          {personas.map(p => (
            <button
              key={p.id}
              onClick={() => onSelectPersona(p.id)}
              className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-t transition-colors
                ${activePersonaId === p.id ? 'bg-bauhaus-black text-white' : 'text-gray-500 hover:text-bauhaus-black'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Persona paths */}
      <div className="space-y-6">
        {displayPersonas.map(p => (
          <PersonaPath key={p.id} persona={p} />
        ))}
      </div>

      {/* Empty state */}
      {personas.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-2xl mb-2">🗺️</p>
          <p className="text-sm font-bold text-gray-600">No personas yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Start a conversation with the journey guide to map your first persona
          </p>
        </div>
      )}
    </div>
  );
}

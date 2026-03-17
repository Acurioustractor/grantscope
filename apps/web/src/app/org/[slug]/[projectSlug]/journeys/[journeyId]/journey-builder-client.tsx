'use client';

import { useState, useCallback } from 'react';
import { JourneyChat, type JourneyUpdate } from '../../../../_components/journey-chat';
import { JourneyMap } from '../../../../_components/journey-map';
import type { JourneyFull, JourneyPersonaWithSteps } from '@/lib/services/journey-service';

export function JourneyBuilderClient({
  orgProfileId,
  journeyId,
  initialJourney,
}: {
  orgProfileId: string;
  journeyId: string;
  initialJourney: JourneyFull;
}) {
  const [journey, setJourney] = useState<JourneyFull>(initialJourney);
  const [activePersonaId, setActivePersonaId] = useState<string>('');

  const handleJourneyUpdate = useCallback(async (updates: JourneyUpdate[]) => {
    // Apply updates to local state and persist to server
    setJourney(prev => {
      let next = { ...prev, personas: [...prev.personas] };

      for (const update of updates) {
        if (update.type === 'persona_created') {
          // Check if persona already exists
          const exists = next.personas.find(
            p => p.label.toLowerCase() === update.persona.label.toLowerCase(),
          );
          if (!exists) {
            const newPersona: JourneyPersonaWithSteps = {
              id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              journey_id: journeyId,
              label: update.persona.label,
              description: update.persona.description ?? null,
              cohort: update.persona.cohort ?? null,
              context: update.persona.context ?? null,
              sort_order: next.personas.length,
              metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              steps: [],
            };
            next = { ...next, personas: [...next.personas, newPersona] };

            // Persist to server
            fetch(`/api/org/${orgProfileId}/journeys/${journeyId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'upsert_persona',
                persona: {
                  label: update.persona.label,
                  description: update.persona.description,
                  cohort: update.persona.cohort,
                  context: update.persona.context,
                  sort_order: newPersona.sort_order,
                },
              }),
            }).then(r => r.json()).then(saved => {
              // Update temp ID with real ID
              setJourney(j => ({
                ...j,
                personas: j.personas.map(p =>
                  p.id === newPersona.id ? { ...p, id: saved.id } : p,
                ),
              }));
            }).catch(() => {});
          }
        }

        if (update.type === 'step_added') {
          const personaIdx = next.personas.findIndex(
            p => p.label.toLowerCase() === update.personaLabel.toLowerCase(),
          );
          if (personaIdx >= 0) {
            const persona = next.personas[personaIdx];
            const newStep = {
              id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              persona_id: persona.id,
              path: update.step.path,
              step_number: update.step.step_number,
              title: update.step.title,
              description: update.step.description ?? null,
              system: update.step.system ?? null,
              emotion: update.step.emotion ?? null,
              duration: update.step.duration ?? null,
              is_divergence_point: update.step.is_divergence_point ?? false,
              icon: update.step.icon ?? null,
              metadata: {},
              created_at: new Date().toISOString(),
              matches: [],
            };
            const updatedPersonas = [...next.personas];
            updatedPersonas[personaIdx] = {
              ...persona,
              steps: [...persona.steps, newStep],
            };
            next = { ...next, personas: updatedPersonas };

            // Persist (only if persona has real ID)
            if (!persona.id.startsWith('temp-')) {
              fetch(`/api/org/${orgProfileId}/journeys/${journeyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'upsert_step',
                  personaId: persona.id,
                  step: {
                    path: update.step.path,
                    step_number: update.step.step_number,
                    title: update.step.title,
                    description: update.step.description,
                    system: update.step.system,
                    emotion: update.step.emotion,
                    duration: update.step.duration,
                    is_divergence_point: update.step.is_divergence_point,
                    icon: update.step.icon,
                  },
                }),
              }).catch(() => {});
            }
          }
        }

        if (update.type === 'match_found') {
          // Find the step by title and add the match
          for (let pi = 0; pi < next.personas.length; pi++) {
            const persona = next.personas[pi];
            const stepIdx = persona.steps.findIndex(
              s => s.title.toLowerCase() === update.stepTitle.toLowerCase(),
            );
            if (stepIdx >= 0) {
              const updatedPersonas = [...next.personas];
              const updatedSteps = [...persona.steps];
              updatedSteps[stepIdx] = {
                ...updatedSteps[stepIdx],
                matches: [
                  ...updatedSteps[stepIdx].matches,
                  {
                    id: `temp-${Date.now()}`,
                    step_id: updatedSteps[stepIdx].id,
                    match_type: update.match.match_type,
                    match_id: null,
                    match_name: update.match.match_name,
                    match_detail: update.match.match_detail ?? null,
                    confidence: update.match.confidence ?? 0.5,
                    created_at: new Date().toISOString(),
                  },
                ],
              };
              updatedPersonas[pi] = { ...persona, steps: updatedSteps };
              next = { ...next, personas: updatedPersonas };
              break;
            }
          }
        }
      }

      return next;
    });
  }, [orgProfileId, journeyId]);

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: Chat */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
        <JourneyChat
          orgProfileId={orgProfileId}
          journeyId={journeyId}
          journey={journey}
          onJourneyUpdate={handleJourneyUpdate}
        />
      </div>

      {/* Right: Live Map Preview */}
      <div className="w-1/2 overflow-y-auto p-6" style={{ height: 'calc(100vh - 120px)' }}>
        <JourneyMap
          title={journey.title}
          personas={journey.personas}
          activePersonaId={activePersonaId || undefined}
          onSelectPersona={setActivePersonaId}
        />
      </div>
    </div>
  );
}

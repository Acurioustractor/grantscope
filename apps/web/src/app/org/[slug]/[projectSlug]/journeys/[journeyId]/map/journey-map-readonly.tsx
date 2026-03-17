'use client';

import { JourneyMap } from '../../../../../_components/journey-map';
import type { JourneyFull } from '@/lib/services/journey-service';
import { useState } from 'react';

export function JourneyMapReadOnly({ journey }: { journey: JourneyFull }) {
  const [activePersonaId, setActivePersonaId] = useState<string>('');

  return (
    <JourneyMap
      title={journey.title}
      personas={journey.personas}
      activePersonaId={activePersonaId || undefined}
      onSelectPersona={setActivePersonaId}
    />
  );
}

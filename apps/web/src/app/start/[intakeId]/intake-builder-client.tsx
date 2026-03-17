'use client';

import { useState, useCallback } from 'react';
import { IntakeChat, type IntakeUpdate } from '../_components/intake-chat';
import { IntelligencePanel } from '../_components/intelligence-panel';

export function IntakeBuilderClient({
  intakeId,
  initialPhase,
}: {
  intakeId: string;
  initialPhase: string;
  initialMessages: unknown[];
}) {
  const [allUpdates, setAllUpdates] = useState<IntakeUpdate[]>([]);

  const handleIntakeUpdate = useCallback((updates: IntakeUpdate[]) => {
    setAllUpdates(prev => [...prev, ...updates]);

    // Persist extracted data to the intake record
    for (const u of updates) {
      const body: Record<string, unknown> = {};

      switch (u.type) {
        case 'phase_change':
          if (u.phase) body.phase = u.phase;
          break;
        case 'idea_extracted':
          if (u.idea_summary) body.idea_summary = u.idea_summary;
          if (u.problem_statement) body.problem_statement = u.problem_statement;
          if (u.issue_areas) body.issue_areas = u.issue_areas;
          if (u.geographic_focus) body.geographic_focus = u.geographic_focus;
          break;
        case 'beneficiary_extracted':
          if (u.target_beneficiary) body.target_beneficiary = u.target_beneficiary;
          break;
        case 'entity_recommended':
          if (u.recommended_entity_type) body.recommended_entity_type = u.recommended_entity_type;
          if (u.entity_type_rationale) body.entity_type_rationale = u.entity_type_rationale;
          break;
        case 'landscape_shown':
          if (u.orgs) body.existing_orgs_shown = u.orgs;
          break;
        case 'funding_matched':
          if (u.grants) body.matched_grants = u.grants;
          if (u.foundations) body.matched_foundations = u.foundations;
          break;
        case 'plan_generated':
          if (u.action_plan) body.action_plan = u.action_plan;
          if (u.draft_email) body.draft_email = u.draft_email;
          break;
      }

      if (Object.keys(body).length > 0) {
        fetch(`/api/start/${intakeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch(() => {});
      }
    }
  }, [intakeId]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Chat panel — left side */}
      <div className="flex-1 min-w-0 flex flex-col">
        <IntakeChat
          intakeId={intakeId}
          initialPhase={initialPhase}
          onIntakeUpdate={handleIntakeUpdate}
        />
      </div>

      {/* Intelligence panel — right side */}
      <div className="w-[380px] shrink-0 hidden lg:block">
        <IntelligencePanel
          intakeId={intakeId}
          updates={allUpdates}
        />
      </div>
    </div>
  );
}

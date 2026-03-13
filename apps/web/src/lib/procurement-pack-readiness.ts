export interface PackReadinessShortlistLike {
  recommendation_summary?: string | null;
  owner_name?: string | null;
  owner_user_id?: string | null;
  approver_user_id?: string | null;
  decision_due_at?: string | null;
}

export interface PackReadinessItemLike {
  id?: string | null;
  supplier_name: string;
  decision_tag?: string | null;
  note?: string | null;
  review_checklist?: unknown;
  evidence_snapshot?: unknown;
}

export interface PackReadinessBlocker {
  code:
    | 'missing_recommendation_summary'
    | 'missing_owner'
    | 'missing_approver'
    | 'missing_decision_due'
    | 'missing_recommended_supplier'
    | 'placeholder_note'
    | 'missing_note'
    | 'missing_source_count'
    | 'missing_confidence'
    | 'missing_checklist';
  message: string;
  supplier_name?: string;
  shortlist_item_id?: string;
  target_mode: 'work' | 'signoff';
  target_section_id: string;
  target_field_id: string;
  action_label: string;
}

const ACTIVE_DECISION_TAGS = new Set(['priority', 'engage', 'reviewing']);
const RECOMMENDATION_DECISION_TAGS = new Set(['priority', 'engage']);
const PLACEHOLDER_NOTE_PATTERN = /\b(test|testing|tbd|todo|asdf|lorem)\b/i;

export function normalizePackChecklist(value: unknown) {
  const checklist = typeof value === 'object' && value ? value as Record<string, unknown> : {};
  return {
    fit: checklist.fit === true,
    risk_checked: checklist.risk_checked === true,
    evidence_checked: checklist.evidence_checked === true,
    decision_made: checklist.decision_made === true,
  };
}

export function packChecklistCount(value: unknown) {
  return Object.values(normalizePackChecklist(value)).filter(Boolean).length;
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sourceCountFromEvidence(value: unknown) {
  const evidence = typeof value === 'object' && value ? value as Record<string, unknown> : {};
  if (typeof evidence.source_count === 'number') return evidence.source_count;
  const datasets = Array.isArray(evidence.source_datasets)
    ? evidence.source_datasets.filter((dataset) => typeof dataset === 'string')
    : [];
  return datasets.length;
}

function confidenceFromEvidence(value: unknown) {
  const evidence = typeof value === 'object' && value ? value as Record<string, unknown> : {};
  return textValue(evidence.confidence) || textValue(evidence.confidence_label);
}

function looksPlaceholderNote(note: string | null) {
  if (!note) return false;
  return PLACEHOLDER_NOTE_PATTERN.test(note);
}

function signoffTarget(fieldId: string, actionLabel: string) {
  return {
    target_mode: 'signoff' as const,
    target_section_id: 'decision-signoff',
    target_field_id: fieldId,
    action_label: actionLabel,
  };
}

function supplierTarget(
  item: PackReadinessItemLike,
  params: {
    fieldIdPrefix: 'supplier-note' | 'supplier-evidence' | 'supplier-checklist';
    actionLabel: string;
  },
) {
  return {
    shortlist_item_id: item.id || undefined,
    supplier_name: item.supplier_name,
    target_mode: 'work' as const,
    target_section_id: 'procurement-workspace',
    target_field_id: item.id ? `${params.fieldIdPrefix}-${item.id}` : 'procurement-workspace',
    action_label: params.actionLabel,
  };
}

export function getDecisionPackBlockers(params: {
  shortlist: PackReadinessShortlistLike | null | undefined;
  items: PackReadinessItemLike[];
}) {
  const blockers: PackReadinessBlocker[] = [];
  const shortlist = params.shortlist;
  const activeItems = params.items.filter((item) => ACTIVE_DECISION_TAGS.has(item.decision_tag || ''));
  const recommendedItems = params.items.filter((item) => RECOMMENDATION_DECISION_TAGS.has(item.decision_tag || ''));

  if (!textValue(shortlist?.recommendation_summary)) {
    blockers.push({
      code: 'missing_recommendation_summary',
      message: 'Add a recommendation summary before generating a decision pack.',
      ...signoffTarget('brief-recommendation-summary', 'Write recommendation summary'),
    });
  }

  if (!textValue(shortlist?.owner_name) && !textValue(shortlist?.owner_user_id)) {
    blockers.push({
      code: 'missing_owner',
      message: 'Assign a shortlist owner before generating a decision pack.',
      ...signoffTarget('brief-owner-user-id', 'Assign shortlist owner'),
    });
  }

  if (!textValue(shortlist?.approver_user_id)) {
    blockers.push({
      code: 'missing_approver',
      message: 'Assign an approver before generating a decision pack.',
      ...signoffTarget('brief-approver-user-id', 'Assign approver'),
    });
  }

  if (!textValue(shortlist?.decision_due_at)) {
    blockers.push({
      code: 'missing_decision_due',
      message: 'Set a decision due date before generating a decision pack.',
      ...signoffTarget('brief-decision-due-at', 'Set decision due date'),
    });
  }

  if (recommendedItems.length === 0) {
    blockers.push({
      code: 'missing_recommended_supplier',
      message: 'Tag at least one supplier as Priority or Engage before generating a decision pack.',
      target_mode: 'work',
      target_section_id: 'procurement-workspace',
      target_field_id: 'procurement-workspace',
      action_label: 'Choose recommended suppliers',
    });
  }

  for (const item of activeItems) {
    const supplierName = item.supplier_name;
    const note = textValue(item.note);
    const sourceCount = sourceCountFromEvidence(item.evidence_snapshot);
    const confidence = confidenceFromEvidence(item.evidence_snapshot);
    const checklistCount = packChecklistCount(item.review_checklist);

    if (!note) {
      blockers.push({
        code: 'missing_note',
        message: `${supplierName}: add an analyst note before exporting.`,
        ...supplierTarget(item, {
          fieldIdPrefix: 'supplier-note',
          actionLabel: `Add analyst note for ${supplierName}`,
        }),
      });
    } else if (looksPlaceholderNote(note)) {
      blockers.push({
        code: 'placeholder_note',
        message: `${supplierName}: replace placeholder or test note text before exporting.`,
        ...supplierTarget(item, {
          fieldIdPrefix: 'supplier-note',
          actionLabel: `Replace placeholder note for ${supplierName}`,
        }),
      });
    }

    if (sourceCount <= 0) {
      blockers.push({
        code: 'missing_source_count',
        message: `${supplierName}: attach evidence with at least one source before exporting.`,
        ...supplierTarget(item, {
          fieldIdPrefix: 'supplier-evidence',
          actionLabel: `Attach evidence for ${supplierName}`,
        }),
      });
    }

    if (!confidence) {
      blockers.push({
        code: 'missing_confidence',
        message: `${supplierName}: set an evidence confidence before exporting.`,
        ...supplierTarget(item, {
          fieldIdPrefix: 'supplier-evidence',
          actionLabel: `Set confidence for ${supplierName}`,
        }),
      });
    }

    if (checklistCount <= 0) {
      blockers.push({
        code: 'missing_checklist',
        message: `${supplierName}: complete at least one review checklist item before exporting.`,
        ...supplierTarget(item, {
          fieldIdPrefix: 'supplier-checklist',
          actionLabel: `Complete checklist for ${supplierName}`,
        }),
      });
    }
  }

  return blockers;
}

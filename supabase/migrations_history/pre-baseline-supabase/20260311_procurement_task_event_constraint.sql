-- Extend shortlist audit events to include task lifecycle changes.

ALTER TABLE procurement_shortlist_events
  DROP CONSTRAINT IF EXISTS procurement_shortlist_events_event_type_check;

ALTER TABLE procurement_shortlist_events
  ADD CONSTRAINT procurement_shortlist_events_event_type_check
  CHECK (
    event_type IN (
      'shortlist_created',
      'shortlist_updated',
      'item_added',
      'item_removed',
      'note_updated',
      'decision_updated',
      'task_created',
      'task_updated',
      'task_completed'
    )
  );

import type { TrackedItemRef, ChecklistItemId, ButtonActionDef } from '../types'

/** Extract a ChecklistItemId from a TrackedItemRef. */
export function refToId(ref: TrackedItemRef): ChecklistItemId {
  return { checklistId: ref.checklistId, itemId: ref.item.id }
}

/**
 * Standard snooze / someday / delete action strip.
 * Used by DayView and WeekView.
 * Pass `null` for `onDelete` to omit the delete button (e.g. for checklist tasks).
 */
export function makeSnoozeSomedayDeleteActions(
  ref: TrackedItemRef,
  onSnooze: (id: ChecklistItemId, date: string) => void,
  onSomeday: (id: ChecklistItemId) => void,
  onDelete: ((id: ChecklistItemId) => void) | null,
): ButtonActionDef[] {
  const id = refToId(ref)
  const actions: ButtonActionDef[] = [
    { label: '💤', title: 'Snooze', variant: 'icon', snooze: (date) => onSnooze(id, date) },
    { label: '☁', title: 'Someday', variant: 'icon', onClick: () => onSomeday(id) },
  ]
  if (onDelete !== null) {
    actions.push({ label: '✕', title: 'Delete', variant: 'danger', onClick: () => onDelete(id) })
  }
  return actions
}

/**
 * Status-aware actions: activate (when snoozed/someday), snooze, optional someday, delete.
 * Used by BacklogView (with onSomeday).
 * Pass `null` for `onDelete` to omit the delete button (e.g. for checklist tasks).
 */
export function makeStatusActions(
  ref: TrackedItemRef,
  options: {
    onActivate: (id: ChecklistItemId) => void
    onSnooze: (id: ChecklistItemId, date: string) => void
    onSomeday?: (id: ChecklistItemId) => void
    onDelete: ((id: ChecklistItemId) => void) | null
  },
): ButtonActionDef[] {
  const id = refToId(ref)
  const status = ref.item.status ?? 'active'
  const actions: ButtonActionDef[] = []
  if (status !== 'active') {
    actions.push({ label: '↩', title: 'Activate', variant: 'icon', onClick: () => options.onActivate(id) })
  }
  if (status === 'active') {
    actions.push({ label: '💤', title: 'Snooze', variant: 'icon', snooze: (date) => options.onSnooze(id, date) })
    if (options.onSomeday) {
      actions.push({ label: '☁', title: 'Someday', variant: 'icon', onClick: () => options.onSomeday!(id) })
    }
  }
  if (options.onDelete !== null) {
    actions.push({ label: '✕', title: 'Delete', variant: 'danger', onClick: () => options.onDelete!(id) })
  }
  return actions
}

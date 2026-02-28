export type ChecklistKind = 'one-time' | 'template' | 'run'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Checklist {
  id: string
  kind: ChecklistKind
  title: string
  items: ChecklistItem[]
  archived: boolean
  createdAt: string
  archivedAt: string | null
  templateId: string | null
  runLabel: string | null
}

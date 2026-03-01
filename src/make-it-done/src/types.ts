export type ChecklistKind = 'one-time' | 'template' | 'run'

export interface ChecklistItem {
  type: 'item'
  id: string
  text: string
  done: boolean
}

export interface ChecklistItemGroup {
  type: 'group'
  id: string
  title: string
  collapsed: boolean
  children: ChecklistNode[]
}

export type ChecklistNode = ChecklistItem | ChecklistItemGroup

export interface Checklist {
  id: string
  kind: ChecklistKind
  title: string
  items: ChecklistNode[]
  archived: boolean
  createdAt: string
  archivedAt: string | null
  templateId: string | null
  runLabel: string | null
}

import { ref, computed, watch } from 'vue'
import type { Checklist, ChecklistItem, ChecklistKind } from '../types'

const STORAGE_KEY = 'make-it-done-v1'

const checklists = ref<Checklist[]>([])

function hydrate(): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as { checklists: Checklist[] }
    checklists.value = parsed.checklists ?? []
  } catch {
    // silent fail — corrupt data, start fresh
  }
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ checklists: checklists.value }))
}

hydrate()
watch(checklists, persist, { deep: true })

// Private helpers

function findChecklist(id: string): Checklist | undefined {
  return checklists.value.find(c => c.id === id)
}

function findItem(checklist: Checklist, itemId: string): ChecklistItem | undefined {
  return checklist.items.find(i => i.id === itemId)
}

// Computed views

const activeChecklists = computed(() =>
  checklists.value
    .filter(c => c.kind !== 'template' && !c.archived)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
)

const templates = computed(() =>
  checklists.value.filter(c => c.kind === 'template')
)

const archivedChecklists = computed(() =>
  checklists.value
    .filter(c => c.archived)
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
)

// Exposed functions

function createChecklist(
  kind: ChecklistKind,
  title: string,
  items: Omit<ChecklistItem, 'id'>[],
): Checklist {
  const checklist: Checklist = {
    id: crypto.randomUUID(),
    kind,
    title,
    items: items.map(i => ({ ...i, id: crypto.randomUUID() })),
    archived: false,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    templateId: null,
    runLabel: null,
  }
  checklists.value.push(checklist)
  return checklist
}

function updateChecklist(
  id: string,
  patch: { title?: string; items?: ChecklistItem[] },
): void {
  const checklist = findChecklist(id)
  if (!checklist) return
  if (patch.title !== undefined) checklist.title = patch.title
  if (patch.items !== undefined) checklist.items = patch.items
}

function deleteChecklist(id: string): void {
  const target = findChecklist(id)
  if (!target) return
  if (target.kind === 'template') {
    checklists.value = checklists.value.filter(c => c.id !== id && c.templateId !== id)
  } else {
    checklists.value = checklists.value.filter(c => c.id !== id)
  }
}

function toggleItem(checklistId: string, itemId: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  const item = findItem(checklist, itemId)
  if (!item) return
  item.done = !item.done
}

function archiveChecklist(id: string): void {
  const checklist = findChecklist(id)
  if (!checklist) return
  checklist.archived = true
  checklist.archivedAt = new Date().toISOString()
}

function unarchiveChecklist(id: string): void {
  const checklist = findChecklist(id)
  if (!checklist) return
  checklist.archived = false
  checklist.archivedAt = null
}

function runTemplate(templateId: string): Checklist {
  const template = findChecklist(templateId)
  if (!template) throw new Error(`Template ${templateId} not found`)
  let runCount = 0
  for (const c of checklists.value) if (c.templateId === templateId) runCount++
  const run: Checklist = {
    id: crypto.randomUUID(),
    kind: 'run',
    title: template.title,
    items: template.items.map(i => ({
      id: crypto.randomUUID(),
      text: i.text,
      done: false,
    })),
    archived: false,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    templateId,
    runLabel: `${template.title} — Run #${runCount + 1}`,
  }
  checklists.value.push(run)
  return run
}

function addItem(checklistId: string, text: string): ChecklistItem {
  const checklist = findChecklist(checklistId)
  if (!checklist) throw new Error(`Checklist ${checklistId} not found`)
  const item: ChecklistItem = { id: crypto.randomUUID(), text, done: false }
  checklist.items.push(item)
  return item
}

function updateItemText(checklistId: string, itemId: string, text: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  const item = findItem(checklist, itemId)
  if (!item) return
  item.text = text
}

function removeItem(checklistId: string, itemId: string): void {
  const checklist = findChecklist(checklistId)
  if (!checklist) return
  checklist.items = checklist.items.filter(i => i.id !== itemId)
}

export function useChecklists() {
  return {
    activeChecklists,
    templates,
    archivedChecklists,
    getChecklist: findChecklist,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    toggleItem,
    archiveChecklist,
    unarchiveChecklist,
    runTemplate,
    addItem,
    updateItemText,
    removeItem,
  }
}

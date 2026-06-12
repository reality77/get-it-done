<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useChecklistStore } from '../../stores/checklists'
import VSegmented from '../atoms/VSegmented.vue'
import ActiveView from './ActiveView.vue'
import TemplatesView from './TemplatesView.vue'
import ArchiveView from './ArchiveView.vue'

const store = useChecklistStore()
const { activeChecklists, templates, archivedChecklists } = storeToRefs(store)

const section = ref<'active' | 'templates' | 'archive'>('active')

const newlyCreatedId = ref<string | null>(null)

async function flashFocus(id: string): Promise<void> {
  newlyCreatedId.value = id
  await nextTick()
  newlyCreatedId.value = null
}

async function handleCreateActive(name: string): Promise<void> {
  const created = store.createChecklist('one-time', name, [])
  await flashFocus(created.id)
}

async function handleCreateTemplate(name: string): Promise<void> {
  const created = store.createChecklist('template', name, [])
  await flashFocus(created.id)
}
</script>

<template>
  <div>
    <VSegmented
      v-model="section"
      :options="[
        { value: 'active', label: 'Active' },
        { value: 'templates', label: 'Templates' },
        { value: 'archive', label: 'Archive' },
      ]"
      class="mb-4"
    />

    <ActiveView
      v-if="section === 'active'"
      :checklists="activeChecklists"
      :focus-checklist-id="newlyCreatedId"
      @delete="store.deleteChecklist"
      @archive="store.archiveChecklist"
      @create="handleCreateActive"
    />

    <TemplatesView
      v-else-if="section === 'templates'"
      :templates="templates"
      :focus-checklist-id="newlyCreatedId"
      @delete="store.deleteChecklist"
      @run="store.runTemplate"
      @create="handleCreateTemplate"
    />

    <ArchiveView
      v-else
      :checklists="archivedChecklists"
      @unarchive="store.unarchiveChecklist"
      @delete="store.deleteChecklist"
    />
  </div>
</template>

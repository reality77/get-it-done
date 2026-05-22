<script setup lang="ts">
import TabItem from '../molecules/TabItem.vue'

defineProps<{
  activeTab: 'today' | 'week' | 'backlog' | 'checklists'
  weeklyReviewDue?: boolean
}>()

defineEmits<{
  (e: 'change', tab: 'today' | 'week' | 'backlog' | 'checklists'): void
}>()
</script>

<template>
  <div class="hidden md:flex gap-6 border-b border-zinc-800 mb-6">
    <TabItem label="Today" :active="activeTab === 'today'" @select="$emit('change', 'today')" />
    <TabItem label="Week" :active="activeTab === 'week'" :dot="weeklyReviewDue" @select="$emit('change', 'week')" />
    <TabItem label="Backlog" :active="activeTab === 'backlog'" @select="$emit('change', 'backlog')" />
    <TabItem label="Checklists" :active="activeTab === 'checklists'" @select="$emit('change', 'checklists')" />
  </div>
</template>

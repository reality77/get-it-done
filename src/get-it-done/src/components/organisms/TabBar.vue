<script setup lang="ts">
import TabItem from '../molecules/TabItem.vue'

defineProps<{
  activeTab: 'active' | 'templates' | 'archive' | 'tasks'
  archiveCount: number
  weeklyReviewDue?: boolean
}>()

defineEmits<{
  (e: 'change', tab: 'active' | 'templates' | 'archive' | 'tasks'): void
}>()
</script>

<template>
  <div class="hidden md:flex gap-6 border-b border-zinc-800 mb-6">
    <TabItem label="Tasks" :active="activeTab === 'tasks'" :dot="weeklyReviewDue" @select="$emit('change', 'tasks')" />
    <TabItem label="Lists" :active="activeTab === 'active'" @select="$emit('change', 'active')" />
    <TabItem label="Templates" :active="activeTab === 'templates'" @select="$emit('change', 'templates')" />
    <TabItem label="Archives" :active="activeTab === 'archive'" :count="archiveCount" @select="$emit('change', 'archive')" />
  </div>
</template>

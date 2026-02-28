<script setup lang="ts">
import TabItem from '../molecules/TabItem.vue'

defineProps<{
  activeTab: 'active' | 'templates' | 'archive'
  archiveCount: number
}>()

defineEmits<{
  (e: 'change', tab: 'active' | 'templates' | 'archive'): void
}>()
</script>

<template>
  <div class="flex gap-6 border-b border-zinc-800 mb-6">
    <TabItem label="Active" :active="activeTab === 'active'" @select="$emit('change', 'active')" />
    <TabItem label="Templates" :active="activeTab === 'templates'" @select="$emit('change', 'templates')" />
    <TabItem label="Archive" :active="activeTab === 'archive'" :count="archiveCount" @select="$emit('change', 'archive')" />
  </div>
</template>

<script setup lang="ts">
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
  <nav
    class="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm"
    style="padding-bottom: max(env(safe-area-inset-bottom), 0.5rem)"
  >
    <!-- Tasks -->
    <button
      class="flex flex-1 flex-col items-center gap-1 pt-3 pb-1 transition-colors cursor-pointer"
      :class="activeTab === 'tasks' ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'"
      @click="$emit('change', 'tasks')"
    >
      <div class="relative">
        <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <span
          v-if="weeklyReviewDue"
          class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-400"
        />
      </div>
      <span class="text-[10px] font-medium leading-none">Tasks</span>
    </button>

    <!-- Lists -->
    <button
      class="flex flex-1 flex-col items-center gap-1 pt-3 pb-1 transition-colors cursor-pointer"
      :class="activeTab === 'active' ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'"
      @click="$emit('change', 'active')"
    >
      <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="3" cy="6" r="0.5" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="12" r="0.5" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="18" r="0.5" fill="currentColor" stroke="none"/>
      </svg>
      <span class="text-[10px] font-medium leading-none">Lists</span>
    </button>

    <!-- Templates -->
    <button
      class="flex flex-1 flex-col items-center gap-1 pt-3 pb-1 transition-colors cursor-pointer"
      :class="activeTab === 'templates' ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'"
      @click="$emit('change', 'templates')"
    >
      <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
      </svg>
      <span class="text-[10px] font-medium leading-none">Templates</span>
    </button>

    <!-- Archive -->
    <button
      class="flex flex-1 flex-col items-center gap-1 pt-3 pb-1 transition-colors cursor-pointer"
      :class="activeTab === 'archive' ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'"
      @click="$emit('change', 'archive')"
    >
      <div class="relative">
        <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="21 8 21 21 3 21 3 8"/>
          <rect x="1" y="3" width="22" height="5"/>
          <line x1="10" y1="12" x2="14" y2="12"/>
        </svg>
        <span
          v-if="archiveCount > 0"
          class="absolute -top-1 -right-2 min-w-[1rem] h-4 px-1 rounded-full bg-zinc-700 text-zinc-300 text-[9px] font-medium flex items-center justify-center leading-none"
        >
          {{ archiveCount }}
        </span>
      </div>
      <span class="text-[10px] font-medium leading-none">Archive</span>
    </button>
  </nav>
</template>

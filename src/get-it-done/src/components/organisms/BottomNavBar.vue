<script setup lang="ts">
defineProps<{
  activeTab: 'today' | 'week' | 'backlog' | 'checklists'
}>()

defineEmits<{
  (e: 'change', tab: 'today' | 'week' | 'backlog' | 'checklists'): void
}>()
</script>

<template>
  <nav
    class="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-hairline bg-bg-0/95 backdrop-blur-sm"
    style="padding-bottom: max(env(safe-area-inset-bottom), 0.5rem)"
  >
    <!-- Today -->
    <button
      class="flex flex-1 flex-col items-center gap-1 pt-3 pb-1 transition-colors cursor-pointer"
      :class="activeTab === 'today' ? 'text-primary' : 'text-fg-4 hover:text-fg-2'"
      @click="$emit('change', 'today')"
    >
      <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
      <span class="text-[10px] font-medium leading-none">Today</span>
    </button>

    <!-- Week -->
    <button
      class="flex flex-1 flex-col items-center gap-1 pt-3 pb-1 transition-colors cursor-pointer"
      :class="activeTab === 'week' ? 'text-primary' : 'text-fg-4 hover:text-fg-2'"
      @click="$emit('change', 'week')"
    >
      <div class="relative">
        <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
        </svg>
      </div>
      <span class="text-[10px] font-medium leading-none">Week</span>
    </button>

    <!-- Backlog -->
    <button
      class="flex flex-1 flex-col items-center gap-1 pt-3 pb-1 transition-colors cursor-pointer"
      :class="activeTab === 'backlog' ? 'text-primary' : 'text-fg-4 hover:text-fg-2'"
      @click="$emit('change', 'backlog')"
    >
      <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span class="text-[10px] font-medium leading-none">Backlog</span>
    </button>

    <!-- Checklists -->
    <button
      class="flex flex-1 flex-col items-center gap-1 pt-3 pb-1 transition-colors cursor-pointer"
      :class="activeTab === 'checklists' ? 'text-primary' : 'text-fg-4 hover:text-fg-2'"
      @click="$emit('change', 'checklists')"
    >
      <svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="3" cy="6" r="0.5" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="12" r="0.5" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="18" r="0.5" fill="currentColor" stroke="none"/>
      </svg>
      <span class="text-[10px] font-medium leading-none">Checklists</span>
    </button>
  </nav>
</template>

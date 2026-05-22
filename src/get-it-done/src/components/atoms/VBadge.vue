<script setup lang="ts">
import { computed } from 'vue'

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'solid'

const props = defineProps<{
  variant?: BadgeVariant
  dot?: boolean
}>()

const variants: Record<BadgeVariant, string> = {
  primary:   'bg-[color-mix(in_oklch,var(--color-primary)_18%,transparent)] text-primary',
  secondary: 'bg-[color-mix(in_oklch,var(--color-secondary)_22%,transparent)] text-secondary',
  success:   'bg-[color-mix(in_oklch,var(--color-success)_18%,transparent)] text-success',
  warning:   'bg-[color-mix(in_oklch,var(--color-warning)_18%,transparent)] text-warning',
  danger:    'bg-[color-mix(in_oklch,var(--color-danger)_22%,transparent)] text-danger',
  info:      'bg-[color-mix(in_oklch,var(--color-info)_18%,transparent)] text-info',
  neutral:   'bg-bg-2 text-fg-2',
  solid:     'bg-primary text-fg-on-primary',
}

const classes = computed(() => [
  'inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full',
  'text-[11px] font-semibold leading-none tracking-wide',
  variants[props.variant ?? 'neutral'],
])
</script>

<template>
  <span :class="classes">
    <span v-if="dot" class="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
    <slot />
  </span>
</template>

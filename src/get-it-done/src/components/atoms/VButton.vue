<script setup lang="ts">
import { computed } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'icon'
type ButtonSize = 'sm' | 'md' | 'lg'

const props = defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  as?: string
  type?: 'button' | 'submit' | 'reset'
}>()

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-2 gap-1.5',
  md: 'h-[42px] px-[18px] text-sm rounded-2 gap-2',
  lg: 'h-[52px] px-6 text-base rounded-3 gap-2',
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-fg-on-primary shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-primary)_30%,transparent),0_8px_28px_-6px_color-mix(in_oklch,var(--color-primary)_35%,transparent)] hover:brightness-110',
  secondary:
    'bg-bg-2 text-fg ring-1 ring-inset ring-border hover:bg-bg-3',
  outline:
    'bg-transparent text-fg ring-1 ring-inset ring-border-strong hover:bg-bg-1',
  ghost:
    'bg-transparent text-fg-2 hover:bg-bg-1 hover:text-fg',
  danger:
    'bg-danger text-white hover:brightness-110',
  icon:
    'bg-transparent text-fg-3 hover:text-fg p-1 rounded',
}

const variant = computed(() => props.variant ?? 'primary')
const size = computed(() => props.size ?? 'md')

const classes = computed(() => [
  'inline-flex items-center justify-center whitespace-nowrap font-semibold cursor-pointer',
  'transition-[transform,background-color,box-shadow,filter] duration-150',
  'active:translate-y-px active:scale-[.99]',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:scale-100',
  variant.value !== 'icon' && sizeClasses[size.value],
  variantClasses[variant.value],
])
</script>

<template>
  <component
    :is="as ?? 'button'"
    :type="as ? undefined : (type ?? 'button')"
    :disabled="disabled"
    :class="classes"
  >
    <slot name="icon-left" />
    <slot />
    <slot name="icon-right" />
  </component>
</template>

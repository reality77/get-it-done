<script setup lang="ts">
import { computed } from 'vue'

type Option = string | number | { value: string | number; label: string }

const props = defineProps<{
  modelValue: string | number
  options: Option[]
  fullWidth?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const normalized = computed(() =>
  props.options.map((o) =>
    typeof o === 'object' ? o : { value: o, label: String(o) }
  )
)

const fullWidth = props.fullWidth ?? true
</script>

<template>
  <div
    role="radiogroup"
    class="inline-flex p-1 gap-0 bg-bg-1 border border-border rounded-3"
    :class="fullWidth && 'w-full flex'"
  >
    <button
      v-for="o in normalized"
      :key="o.value"
      type="button"
      role="radio"
      :aria-checked="o.value === modelValue"
      :class="[
        'border-0 font-semibold text-[13px] px-[18px] py-2.5 rounded-2',
        'transition-[color,background-color] duration-150 capitalize cursor-pointer',
        fullWidth && 'flex-1',
        o.value === modelValue
          ? 'bg-primary text-fg-on-primary'
          : 'bg-transparent text-fg-3 hover:text-fg-2',
      ]"
      @click="emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

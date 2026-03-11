import type { Directive } from 'vue'

export const vFocus: Directive = {
  mounted(el: HTMLInputElement) {
    el.focus()
    el.select()
  },
}

import type { Directive } from 'vue'

export const vFocus: Directive = {
  mounted(el: HTMLElement) {
    el.focus()
    if ('select' in el && typeof (el as HTMLInputElement | HTMLTextAreaElement).select === 'function') {
      (el as HTMLInputElement | HTMLTextAreaElement).select()
    }
  },
}

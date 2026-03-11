import { ref } from 'vue'

/**
 * Reusable inline edit state: isEditing, editText, startEdit, confirmEdit, cancelEdit.
 *
 * @param getInitial  Called on startEdit to seed editText with the current value.
 * @param onConfirm   Called with the trimmed, non-empty value when the user confirms.
 */
export function useEditableField(
  getInitial: () => string,
  onConfirm: (value: string) => void,
) {
  const isEditing = ref(false)
  const editText = ref('')

  function startEdit(): void {
    editText.value = getInitial()
    isEditing.value = true
  }

  function confirmEdit(): void {
    const v = editText.value.trim()
    if (v) onConfirm(v)
    isEditing.value = false
    editText.value = ''
  }

  function cancelEdit(): void {
    isEditing.value = false
    editText.value = ''
  }

  return { isEditing, editText, startEdit, confirmEdit, cancelEdit }
}

/**
 * Returns a keydown handler that calls onEnter on Enter (preventing default)
 * and onEscape on Escape.
 */
export function makeKeydownHandler(
  onEnter: () => void,
  onEscape: () => void,
): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter() }
    else if (e.key === 'Escape') { onEscape() }
  }
}

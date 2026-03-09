export interface SnoozeOption {
  label: string
  date: string
}

export function getSnoozeOptions(): SnoozeOption[] {
  const today = new Date()
  const add = (days: number): string => {
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const nextMonday = (): string => {
    const d = new Date(today)
    const dayOfWeek = d.getDay()
    const daysUntil = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7 || 7)
    d.setDate(d.getDate() + daysUntil)
    return d.toISOString().slice(0, 10)
  }
  return [
    { label: 'Tomorrow',    date: add(1) },
    { label: 'In 3 days',   date: add(3) },
    { label: 'Next week',   date: add(7) },
    { label: 'Next Monday', date: nextMonday() },
  ]
}

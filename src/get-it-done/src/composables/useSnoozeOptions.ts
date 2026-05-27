export interface SnoozeOption {
  label: string
  date: string
}

function nextMondayDate(weeksAhead: number): string {
  const d = new Date()
  const dayOfWeek = d.getDay()
  const daysUntilMonday = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7 || 7)
  d.setDate(d.getDate() + daysUntilMonday + (weeksAhead - 1) * 7)
  return d.toISOString().slice(0, 10)
}

function addMonthsToToday(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function getSnoozeOptions(): SnoozeOption[] {
  return [
    { label: 'Next week',  date: nextMondayDate(1) },
    { label: '2 weeks',    date: nextMondayDate(2) },
    { label: '3 weeks',    date: nextMondayDate(3) },
    { label: '1 month',    date: addMonthsToToday(1) },
    { label: '2 months',   date: addMonthsToToday(2) },
    { label: '6 months',   date: addMonthsToToday(6) },
  ]
}

export function getDeadlineSnoozeOptions(deadline: string): SnoozeOption[] {
  const todayStr = new Date().toISOString().slice(0, 10)
  const dl = new Date(deadline.slice(0, 10))

  const subtractDays = (days: number): string => {
    const d = new Date(dl)
    d.setDate(d.getDate() - days)
    return d.toISOString().slice(0, 10)
  }

  const subtractMonths = (months: number): string => {
    const d = new Date(dl)
    d.setMonth(d.getMonth() - months)
    return d.toISOString().slice(0, 10)
  }

  const candidates: SnoozeOption[] = [
    { label: '1 month before',  date: subtractMonths(1) },
    { label: '2 weeks before',  date: subtractDays(14) },
    { label: '1 week before',   date: subtractDays(7) },
    { label: '3 days before',   date: subtractDays(3) },
    { label: '1 day before',    date: subtractDays(1) },
  ]

  return candidates.filter(opt => opt.date > todayStr)
}

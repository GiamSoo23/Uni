/** A calendar date with a 1-based month. */
export interface CalendarDate {
  year: number
  month: number
  day: number
}

// Uni's own month table, so the output doesn't depend on the runtime's ICU data.
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** True when the JavaScript runtime accepts `timeZone` as an IANA time zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** The calendar date of `now` in `timeZone`. */
export function todayIn(timeZone: string, now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const part = (type: 'year' | 'month' | 'day'): number => {
    const found = parts.find((p) => p.type === type)
    if (found === undefined) throw new Error(`Intl.DateTimeFormat returned no ${type}`)
    return Number(found.value)
  }
  return { year: part('year'), month: part('month'), day: part('day') }
}

/** Formats a date the way the owner writes Date Applied, e.g. "Sep 7, 2026". */
export function formatDateApplied(date: CalendarDate): string {
  const month = MONTHS[date.month - 1]
  if (month === undefined) throw new RangeError(`Invalid month: ${String(date.month)}`)
  return `${month} ${String(date.day)}, ${String(date.year).padStart(4, '0')}`
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** True for a `YYYY-MM-DD` string naming a date that exists in the proleptic Gregorian calendar. */
export function isIsoCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (match === null) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return false
  return day >= 1 && day <= daysInMonth(year, month)
}

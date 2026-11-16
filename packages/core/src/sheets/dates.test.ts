import { describe, expect, it } from 'vitest'
import { formatDateApplied, isIsoCalendarDate, isValidTimeZone, todayIn } from './dates'

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects others', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('Not/A_Zone')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})

describe('todayIn', () => {
  const now = new Date('2026-11-12T03:30:00Z')

  it('uses the calendar date in the given time zone', () => {
    expect(todayIn('America/New_York', now)).toEqual({ year: 2026, month: 11, day: 11 })
    expect(todayIn('UTC', now)).toEqual({ year: 2026, month: 11, day: 12 })
    expect(todayIn('Asia/Tokyo', now)).toEqual({ year: 2026, month: 11, day: 12 })
  })
})

describe('formatDateApplied', () => {
  it("matches the owner's format", () => {
    expect(formatDateApplied({ year: 2026, month: 11, day: 12 })).toBe('Nov 12, 2026')
    expect(formatDateApplied({ year: 2026, month: 9, day: 7 })).toBe('Sep 7, 2026')
    expect(formatDateApplied({ year: 2027, month: 1, day: 1 })).toBe('Jan 1, 2027')
  })

  it('rejects a month outside 1 to 12', () => {
    expect(() => formatDateApplied({ year: 2026, month: 13, day: 1 })).toThrow(RangeError)
  })
})

describe('isIsoCalendarDate', () => {
  it('accepts dates that exist', () => {
    for (const value of ['2026-11-12', '2024-02-29', '2000-02-29', '2026-12-31']) {
      expect(isIsoCalendarDate(value)).toBe(true)
    }
  })

  it('rejects impossible dates and other formats', () => {
    for (const value of [
      '2026-02-29',
      '1900-02-29',
      '2026-04-31',
      '2026-13-01',
      '2026-00-10',
      '2026-01-00',
      '2026-1-5',
      '2026/11/12',
      'Nov 12, 2026',
      ' 2026-11-12',
      '2026-11-12T00:00',
      '',
    ]) {
      expect(isIsoCalendarDate(value)).toBe(false)
    }
  })
})

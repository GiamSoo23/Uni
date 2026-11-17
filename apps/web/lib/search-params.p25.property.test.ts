// Feature: google-sheets-sync, Property 25: Unknown `applied` values mean hide
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { hrefWith, parseSearchParams } from '@/lib/search-params'

describe('Property 25: unknown applied values mean hide', () => {
  it('parses anything other than "hide" or "show" as hide', () => {
    const value = fc.oneof(
      fc.string(),
      fc.constantFrom('', ' show', 'SHOW', 'Show', 'hide ', 'all'),
      fc.array(fc.string(), { minLength: 1 }),
    )
    fc.assert(
      fc.property(value, (applied) => {
        const first = Array.isArray(applied) ? applied[0] : applied
        const expected = first === 'show' ? 'show' : 'hide'
        expect(parseSearchParams({ applied }).applied).toBe(expected)
      }),
      { numRuns: 200 },
    )
  })

  it('keeps the applied value across hrefWith', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('hide', 'show'),
        fc.integer({ min: 1, max: 50 }),
        (applied, page) => {
          const params = parseSearchParams({ applied })
          const href = hrefWith(params, { page })
          const query = Object.fromEntries(new URL(href, 'http://uni.test').searchParams)
          expect(parseSearchParams(query).applied).toBe(applied)
        },
      ),
      { numRuns: 100 },
    )
  })
})

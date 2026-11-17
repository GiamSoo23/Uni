// Feature: google-sheets-sync, Property 26: Job_ID input validation
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseJobIdForm } from '@/lib/job-id-input'

const form = (entries: readonly (readonly [string, string])[]) => {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

// `.` in a JavaScript regex doesn't match these: LF, CR, LS and PS.
const LINE_TERMINATORS = new Set([0x0a, 0x0d, 0x2028, 0x2029])

const validId = fc
  .string({ minLength: 1, maxLength: 191, unit: fc.constantFrom('a', 'b', '0', '9', '-', '_') })
  .map((id) => `simplify:${id}`)

describe('Property 26: Job_ID input validation', () => {
  it('accepts a single valid jobId and ignores Next.js $ACTION fields', () => {
    fc.assert(
      fc.property(validId, fc.boolean(), (jobId, withNextFields) => {
        const entries: [string, string][] = [['jobId', jobId]]
        if (withNextFields) entries.push(['$ACTION_ID_abc', ''], ['$ACTION_REF_1', 'x'])
        expect(parseJobIdForm(form(entries))).toBe(jobId)
      }),
      { numRuns: 200 },
    )
  })

  it('accepts exactly the strings of 10 to 200 characters that start with simplify: and have no line break after it', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string({ maxLength: 220 }), validId, fc.constant('simplify:')),
        (jobId) => {
          const rest = jobId.slice('simplify:'.length)
          const expected =
            jobId.length >= 10 &&
            jobId.length <= 200 &&
            jobId.startsWith('simplify:') &&
            rest.length > 0 &&
            ![...rest].some((char) => LINE_TERMINATORS.has(char.charCodeAt(0)))
          expect(parseJobIdForm(form([['jobId', jobId]])) !== null).toBe(expected)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('rejects any extra field or a repeated jobId', () => {
    const extraKey = fc.string({ minLength: 1 }).filter((key) => !key.startsWith('$ACTION'))
    fc.assert(
      fc.property(validId, extraKey, fc.string(), (jobId, key, value) => {
        expect(
          parseJobIdForm(
            form([
              ['jobId', jobId],
              [key, value],
            ]),
          ),
        ).toBeNull()
      }),
      { numRuns: 200 },
    )
  })

  it('rejects a __proto__ field', () => {
    expect(
      parseJobIdForm(
        form([
          ['jobId', 'simplify:abc'],
          ['__proto__', 'x'],
        ]),
      ),
    ).toBeNull()
  })

  it('rejects an empty form and a file', () => {
    expect(parseJobIdForm(new FormData())).toBeNull()
    const data = new FormData()
    data.append('jobId', new Blob(['simplify:abcdef']), 'id.txt')
    expect(parseJobIdForm(data)).toBeNull()
  })
})

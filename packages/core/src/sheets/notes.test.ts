import { describe, expect, it } from 'vitest'
import { SIMPLIFY_NOTE, buildNotes } from './notes'

describe('buildNotes', () => {
  it('starts with the ATS sentence when an ATS is detected', () => {
    expect(buildNotes('https://boards.greenhouse.io/acme/jobs/1')).toBe(
      'Greenhouse. Found on the Simplify Summer 2027 GitHub list.',
    )
    expect(buildNotes('https://careers-acme.icims.com/jobs/1')).toBe(`iCIMS. ${SIMPLIFY_NOTE}`)
  })

  it('returns only the Simplify sentence when no ATS is detected', () => {
    expect(buildNotes('https://acme.com/careers/1')).toBe(SIMPLIFY_NOTE)
    expect(buildNotes('not a url')).toBe(SIMPLIFY_NOTE)
    expect(buildNotes('ftp://boards.greenhouse.io/acme')).toBe(SIMPLIFY_NOTE)
  })
})

import { describe, expect, it } from 'vitest'
import { isAppliedStatus } from './status'

describe('isAppliedStatus', () => {
  it('treats any status other than empty, No Role and Not Started as applied', () => {
    expect(isAppliedStatus('Submitted')).toBe(true)
    expect(isAppliedStatus('Interview')).toBe(true)
  })

  it('ignores case and surrounding whitespace for the not-applied values', () => {
    expect(isAppliedStatus('')).toBe(false)
    expect(isAppliedStatus('   ')).toBe(false)
    expect(isAppliedStatus(' NO ROLE ')).toBe(false)
    expect(isAppliedStatus('not started')).toBe(false)
  })
})

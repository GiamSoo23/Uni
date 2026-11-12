import { describe, expect, it } from 'vitest'
import { job, policy } from '../test/fixtures'
import { eligibilityFor } from './eligibility'
import { createPolicyIndex, EMPTY_POLICY_INDEX } from './policy'

const policies = createPolicyIndex([
  policy({ company: 'Defense Co', policy: 'clearance_required' }),
  policy({ company: 'Friendly Bank', policy: 'accepts', source: 'maintainer' }),
])

describe('eligibilityFor', () => {
  it('is not verified when nothing is known', () => {
    expect(eligibilityFor(job(), EMPTY_POLICY_INDEX)).toMatchObject({
      status: 'unknown',
      reason: 'not_verified',
      source: 'none',
    })
  })

  it.each([
    ['does_not_offer', 'ineligible', 'no_sponsorship'],
    ['citizenship_required', 'ineligible', 'citizenship_required'],
    ['offers', 'eligible', 'offers_sponsorship'],
  ] as const)('uses Simplify when the posting says %s', (sponsorship, status, reason) => {
    expect(eligibilityFor(job({ sponsorship }), EMPTY_POLICY_INDEX)).toMatchObject({
      status,
      reason,
      source: 'simplify',
    })
  })

  it('uses the company policy when Simplify says nothing', () => {
    const result = eligibilityFor(job({ company: 'Defense Co' }), policies)
    expect(result).toMatchObject({
      status: 'ineligible',
      reason: 'clearance_required',
      source: 'company',
    })
    expect(result.policy?.company).toBe('Defense Co')
  })

  it('marks a company that accepts international students as eligible', () => {
    expect(eligibilityFor(job({ company: 'Friendly Bank' }), policies)).toMatchObject({
      status: 'eligible',
      reason: 'accepts',
      source: 'company',
    })
  })

  it('lets a role-level flag from Simplify beat a company that accepts', () => {
    const result = eligibilityFor(
      job({ company: 'Friendly Bank', sponsorship: 'does_not_offer' }),
      policies,
    )
    expect(result).toMatchObject({ status: 'ineligible', source: 'simplify' })
  })
})

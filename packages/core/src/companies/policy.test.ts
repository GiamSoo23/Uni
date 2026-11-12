import { describe, expect, it } from 'vitest'
import { policy } from '../test/fixtures'
import {
  BASE_POLICIES,
  BASE_POLICY_INDEX,
  companyPolicySchema,
  createPolicyIndex,
  findCompanyPolicy,
  normalizeCompanyName,
} from './policy'

describe('normalizeCompanyName', () => {
  it.each([
    ['General Dynamics, Inc.', 'general dynamics inc'],
    ['  Booz   Allen ', 'booz allen'],
    ['Pratt & Whitney', 'pratt whitney'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeCompanyName(raw)).toBe(expected)
  })
})

describe('createPolicyIndex', () => {
  it('finds a policy by company name or alias, ignoring case and punctuation', () => {
    const index = createPolicyIndex([policy({ company: 'RTX', aliases: ['Raytheon'] })])
    expect(findCompanyPolicy(index, 'rtx')?.company).toBe('RTX')
    expect(findCompanyPolicy(index, 'RAYTHEON.')?.company).toBe('RTX')
    expect(findCompanyPolicy(index, 'Someone Else')).toBeNull()
  })

  it('lets a later list override an earlier one', () => {
    const base = [policy({ company: 'Bank', policy: 'no_sponsorship' })]
    const overrides = [policy({ company: 'BANK', policy: 'accepts', source: 'sheet' })]
    const index = createPolicyIndex(base, overrides)
    expect(findCompanyPolicy(index, 'Bank')).toMatchObject({ policy: 'accepts', source: 'sheet' })
  })
})

describe('companyPolicySchema', () => {
  it('requires a posting URL for policies read from postings', () => {
    const result = companyPolicySchema.safeParse(
      policy({ evidence: [{ quote: 'U.S. citizenship is required', checkedAt: '2026-11-12' }] }),
    )
    expect(result.success).toBe(false)
  })

  it('accepts a maintainer policy without a URL', () => {
    const result = companyPolicySchema.safeParse(
      policy({
        source: 'maintainer',
        policy: 'accepts',
        evidence: [{ quote: 'Recruiter confirmed at the career fair', checkedAt: '2026-11-12' }],
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a date that is not YYYY-MM-DD', () => {
    const result = companyPolicySchema.safeParse(
      policy({
        evidence: [
          { quote: 'U.S. citizenship is required', url: 'https://x.test', checkedAt: 'Nov 12' },
        ],
      }),
    )
    expect(result.success).toBe(false)
  })
})

describe('the base list in policies.json', () => {
  it('loads and validates', () => {
    expect(BASE_POLICIES.length).toBeGreaterThan(0)
  })

  it('has no company or alias listed twice', () => {
    const names = BASE_POLICIES.flatMap((p) => [p.company, ...p.aliases]).map(normalizeCompanyName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('backs every entry with evidence from a posting', () => {
    for (const entry of BASE_POLICIES) {
      expect(entry.source, entry.company).toBe('posting')
      expect(entry.note, entry.company).toBeDefined()
    }
  })

  it('covers the defense contractors seen in Simplify on Nov 12, 2026', () => {
    for (const name of [
      'Booz Allen',
      'CACI',
      'General Dynamics Information Technology',
      'General Dynamics Mission Systems',
      'RTX',
      'Anduril',
      'Northrop Grumman',
    ]) {
      expect(findCompanyPolicy(BASE_POLICY_INDEX, name), name).not.toBeNull()
    }
  })
})

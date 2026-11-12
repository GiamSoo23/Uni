import type { Job } from '../jobs/job'
import {
  type CompanyPolicy,
  type CompanyPolicyKind,
  findCompanyPolicy,
  type PolicyIndex,
} from './policy'

export type EligibilityStatus = 'eligible' | 'ineligible' | 'unknown'

export type EligibilityReason = CompanyPolicyKind | 'offers_sponsorship' | 'not_verified'

export interface Eligibility {
  status: EligibilityStatus
  reason: EligibilityReason
  /** Where the answer came from. */
  source: 'simplify' | 'company' | 'none'
  /** The company policy behind the answer, when source is 'company'. */
  policy: CompanyPolicy | null
}

const NOT_VERIFIED: Eligibility = {
  status: 'unknown',
  reason: 'not_verified',
  source: 'none',
  policy: null,
}

/**
 * Whether an international student can apply to this role.
 *
 * 1. What Simplify says about this posting wins, because it's specific to the role.
 * 2. Otherwise the company's policy decides (base list, then the user's overrides).
 * 3. Otherwise the answer is "not verified". Silence never counts as "accepts".
 */
export function eligibilityFor(job: Job, policies: PolicyIndex): Eligibility {
  switch (job.sponsorship) {
    case 'does_not_offer':
      return { status: 'ineligible', reason: 'no_sponsorship', source: 'simplify', policy: null }
    case 'citizenship_required':
      return {
        status: 'ineligible',
        reason: 'citizenship_required',
        source: 'simplify',
        policy: null,
      }
    case 'offers':
      return {
        status: 'eligible',
        reason: 'offers_sponsorship',
        source: 'simplify',
        policy: null,
      }
    case 'unknown':
      break
  }

  const policy = findCompanyPolicy(policies, job.company)
  if (policy === null) return NOT_VERIFIED
  return {
    status: policy.policy === 'accepts' ? 'eligible' : 'ineligible',
    reason: policy.policy,
    source: 'company',
    policy,
  }
}

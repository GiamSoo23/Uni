import type { DescriptionFlag } from '../descriptions/detector'
import { type DescriptionIndex, EMPTY_DESCRIPTION_INDEX } from '../descriptions/description-index'
import type { Job } from '../jobs/job'
import { jobIdFor } from '../sheets/matcher'
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
  source: 'simplify' | 'description' | 'company' | 'none'
  /** The company policy behind the answer, when source is 'company'. */
  policy: CompanyPolicy | null
  /** The posting's own sentence, when source is 'description'. */
  flag: DescriptionFlag | null
}

const NOT_VERIFIED: Eligibility = {
  status: 'unknown',
  reason: 'not_verified',
  source: 'none',
  policy: null,
  flag: null,
}

/**
 * Whether an international student can apply to this role.
 *
 * 1. A restriction Simplify states for this posting wins.
 * 2. Then a restriction the posting's description states, because it's specific to the role and
 *    quotes the company itself. It also beats Simplify's "offers sponsorship".
 * 3. Then Simplify's "offers sponsorship".
 * 4. Then the company's policy (base list, then the user's overrides).
 * 5. Otherwise the answer is "not verified". Silence never counts as "accepts".
 */
export function eligibilityFor(
  job: Job,
  policies: PolicyIndex,
  descriptions: DescriptionIndex = EMPTY_DESCRIPTION_INDEX,
): Eligibility {
  const fromSimplify = (status: EligibilityStatus, reason: EligibilityReason): Eligibility => ({
    status,
    reason,
    source: 'simplify',
    policy: null,
    flag: null,
  })
  if (job.sponsorship === 'does_not_offer') return fromSimplify('ineligible', 'no_sponsorship')
  if (job.sponsorship === 'citizenship_required') {
    return fromSimplify('ineligible', 'citizenship_required')
  }

  const flag = descriptions.get(jobIdFor(job))
  if (flag !== undefined) {
    return { status: 'ineligible', reason: flag.kind, source: 'description', policy: null, flag }
  }

  if (job.sponsorship === 'offers') return fromSimplify('eligible', 'offers_sponsorship')

  const policy = findCompanyPolicy(policies, job.company)
  if (policy === null) return NOT_VERIFIED
  return {
    status: policy.policy === 'accepts' ? 'eligible' : 'ineligible',
    reason: policy.policy,
    source: 'company',
    policy,
    flag: null,
  }
}

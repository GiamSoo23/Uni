import { z } from 'zod'
import basePolicies from './policies.json'

/**
 * What a company asks of interns, as far as international students are concerned.
 * Everything except `accepts` makes a role ineligible for an international student.
 */
export const COMPANY_POLICIES = [
  'accepts',
  'no_sponsorship',
  'us_person_required',
  'citizenship_required',
  'clearance_required',
] as const
export type CompanyPolicyKind = (typeof COMPANY_POLICIES)[number]

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

const evidenceSchema = z.object({
  /** Verbatim and short: the sentence that supports the policy. */
  quote: z.string().min(10).max(300),
  url: z.string().refine(isHttpUrl, 'url must be http(s)').optional(),
  checkedAt: z.iso.date(),
})

export const companyPolicySchema = z
  .object({
    company: z.string().min(1),
    aliases: z.array(z.string().min(1)).default([]),
    policy: z.enum(COMPANY_POLICIES),
    /** Limits the policy, for example "Software roles only". Shown to the user. */
    scope: z.string().min(1).optional(),
    /**
     * - posting: read in the company's own job postings (needs a URL)
     * - maintainer: what the person running this instance knows
     * - sheet: an override from the user's Google Sheet
     * - claude: found by Claude in a posting (needs a URL)
     */
    source: z.enum(['posting', 'maintainer', 'sheet', 'claude']),
    note: z.string().min(1).optional(),
    evidence: z.array(evidenceSchema).min(1),
  })
  .superRefine((policy, ctx) => {
    if (policy.source === 'posting' || policy.source === 'claude') {
      policy.evidence.forEach((item, index) => {
        if (item.url === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['evidence', index, 'url'],
            message: `a ${policy.source} policy needs the posting URL`,
          })
        }
      })
    }
  })

export type CompanyPolicy = z.infer<typeof companyPolicySchema>

/** Lowercase, letters and digits only: "General Dynamics, Inc." -> "general dynamics inc". */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export type PolicyIndex = ReadonlyMap<string, CompanyPolicy>

export const EMPTY_POLICY_INDEX: PolicyIndex = new Map()

/**
 * Indexes policies by normalized company name and aliases. Later lists win:
 * pass the base list first and the user's overrides (Google Sheet) after it.
 */
export function createPolicyIndex(...lists: readonly (readonly CompanyPolicy[])[]): PolicyIndex {
  const index = new Map<string, CompanyPolicy>()
  for (const list of lists) {
    for (const policy of list) {
      for (const name of [policy.company, ...policy.aliases]) {
        index.set(normalizeCompanyName(name), policy)
      }
    }
  }
  return index
}

export function findCompanyPolicy(index: PolicyIndex, company: string): CompanyPolicy | null {
  return index.get(normalizeCompanyName(company)) ?? null
}

/** The sourced list that ships with Uni (`policies.json`), validated on load. */
export const BASE_POLICIES: readonly CompanyPolicy[] = z
  .array(companyPolicySchema)
  .parse(basePolicies)

export const BASE_POLICY_INDEX: PolicyIndex = createPolicyIndex(BASE_POLICIES)

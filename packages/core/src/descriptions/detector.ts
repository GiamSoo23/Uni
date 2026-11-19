import { splitSentences } from './text'

/**
 * What a posting asks that an international student can't meet, from strongest to weakest. The
 * names match the company policies, so the inbox labels them the same way.
 */
export const RESTRICTION_KINDS = [
  'clearance_required',
  'citizenship_required',
  'us_person_required',
  'no_sponsorship',
] as const
export type RestrictionKind = (typeof RESTRICTION_KINDS)[number]

/** One restriction found in a posting, with the sentence that says it. */
export interface DescriptionFlag {
  kind: RestrictionKind
  /** The posting's own sentence, at most `MAX_QUOTE_LENGTH` characters. */
  quote: string
}

/** Bump when the rules change, so cached results from older rules are checked again. */
export const DETECTOR_VERSION = 1

export const MAX_QUOTE_LENGTH = 300

const US = String.raw`(?:U\.\s?S\.?|United\s+States|\bUSA?\b)`

/** Words that turn a mention into a requirement. */
const REQUIREMENT =
  /\b(?:must|required?|requires|requiring|only|need(?:ed|s)?|necessary|mandatory|eligib\w*|restricted|limited\s+to|qualif\w*|defined\s+as)\b/i

/** Equal opportunity boilerplate lists citizenship among protected traits. */
const EQUAL_OPPORTUNITY =
  /\b(?:regardless\s+of|without\s+regard\s+to|irrespective\s+of|on\s+the\s+basis\s+of|basis\s+of|discriminat\w*|equal\s+(?:employment\s+)?opportunit\w*|protected\s+(?:class|characteristic|status|veteran)|affirmative\s+action|E-Verify)\b/i

/** "Not required", "Required for this Position: No", "Clearance Type: None". */
const NEGATED =
  /\b(?:not|never)\s+(?:be\s+)?(?:required|necessary|needed|a\s+requirement)\b|\b(?:does|do|will)\s+not\s+(?:need|require)\b|\b(?:citizen\w*|clearances?)\b[^.:]{0,50}:\s*(?:no|none|n\/a|not\s+required)\b|\bno\s+(?:security\s+)?clearance\b/i

/** A wish, not a requirement. */
const PREFERRED =
  /\b(?:preferred|preferably|a\s+plus|nice\s+to\s+have|bonus|desired|desirable|advantage\w*)\b/i

const EXPORT_CONTROL = /\b(?:ITAR|EAR|export[-\s]controll?ed|export\s+control)\b/i

const US_PERSON = new RegExp(String.raw`${US}\s*persons?\b`, 'i')

/** "Where the applicant is not a U.S. person … may decline": a possibility, not a rule. */
const NOT_A_US_PERSON = new RegExp(String.raw`\b(?:not\s+a|non-?)\s*${US}\s*persons?\b`, 'i')

const EXPORT_POSITION =
  /\b(?:position|role|job|work|candidates?|applicants?)\b[^.]{0,60}\b(?:requires?|requiring|subject\s+to)\b[^.]{0,40}(?:\bITAR\b|\bEAR\b|export[-\s]controll?ed)/i

const PERMANENT_RESIDENT = /\b(?:permanent\s+residents?|green\s+card|lawful(?:ly)?\s+permanent)\b/i

const CITIZEN = new RegExp(String.raw`(?:${US}|\bAmerican)\s+citizen(?:s|ship)?\b`, 'i')

const CITIZENSHIP_REQUIRED = /\bcitizenship\b[^.:]{0,40}\brequired\b/i

const CLEARANCE =
  /\b(?:security|secret|top[-\s]secret|TS\/SCI|SCI|DoD|DOE|government|federal|active|public\s+trust|Q|L)\s+clearances?\b|\b(?:obtain|maintain|hold|possess|eligib\w*\s+(?:for|to\s+obtain)|ability\s+to\s+obtain|able\s+to\s+obtain)\b[^.]{0,30}\bclearances?\b|\bclearances?\b[^.]{0,30}\b(?:required|eligibility|level|type)\b/i

const NOT_A_CLEARANCE = /\b(?:customs|medical|export)\s+clearance/i

const CLEARANCE_CUE =
  /\b(?:must|required?|requires|obtain|maintain|hold|possess|eligib\w*|need\w*|ability|able\s+to|active|current(?:ly)?|level|type)\b/i

const NO_SPONSORSHIP = [
  /\b(?:not|unable\s+to|cannot|can['’]t|won['’]t|don['’]t|doesn['’]t|isn['’]t|aren['’]t|no\s+longer)\s+(?:be\s+)?(?:able\s+to\s+)?(?:currently\s+)?(?:[\w,'’/-]+\s+){0,6}?(?:sponsor|sponsorship|sponsoring)\b/i,
  /\bno\s+(?:visa\s+|immigration\s+|employment\s+|work\s+)?sponsorship\b/i,
  /\bwithout\s+(?:the\s+need\s+for\s+)?(?:[\w,'’/-]+\s+){0,6}?sponsorship\b/i,
  /\bsponsorship\s+(?:is\s+|will\s+)?(?:not\s+(?:be\s+)?(?:available|offered|provided|possible)|unavailable)\b/i,
]

/** Sponsorship of events or partners, not visas, and "not only … but we sponsor". */
const NOT_A_VISA =
  /\bsponsor(?:ship|ed|s)?\s+(?:events?|teams?|clubs?|conferences?|hackathons?)\b|\bnot\s+only\b/i

/** Sponsoring an export license is about some nationalities, not every international student. */
const EXPORT_LICENSE = /\bexport\s+licen[cs]es?\b/i
const VISA = /\b(?:visas?|immigration|H-?1B|employment\s+authorization|work\s+authorization)\b/i

/** "May be required depending on program" isn't a requirement for every hire. */
const CONDITIONAL = /\bmay\b/i

function quoteOf(sentence: string, match: RegExpMatchArray | null): string {
  if (sentence.length <= MAX_QUOTE_LENGTH) return sentence
  const at = match?.index ?? 0
  const start = Math.max(0, Math.min(at - 100, sentence.length - MAX_QUOTE_LENGTH))
  const slice = sentence.slice(start, start + MAX_QUOTE_LENGTH - 2).trim()
  return `${start > 0 ? '…' : ''}${slice}…`
}

interface Found extends DescriptionFlag {
  /** How explicit the sentence is. Among sentences of one kind, the most explicit is quoted. */
  strength: 1 | 2
}

function restrictionIn(sentence: string): Found | null {
  if (sentence.trimEnd().endsWith('?')) return null
  const flag = (kind: RestrictionKind, match: RegExpMatchArray | null, strength: 1 | 2 = 2) => ({
    kind,
    quote: quoteOf(sentence, match),
    strength,
  })
  const negated = NEGATED.test(sentence)
  const preferred = PREFERRED.test(sentence)

  const clearance = sentence.match(CLEARANCE)
  if (
    clearance !== null &&
    !NOT_A_CLEARANCE.test(sentence) &&
    CLEARANCE_CUE.test(sentence) &&
    !CONDITIONAL.test(sentence) &&
    !negated &&
    !preferred
  ) {
    return flag('clearance_required', clearance)
  }

  const boilerplate = EQUAL_OPPORTUNITY.test(sentence)
  const onlyPossible = NOT_A_US_PERSON.test(sentence) && CONDITIONAL.test(sentence)
  if (!boilerplate && !negated && !onlyPossible) {
    const citizen = sentence.match(CITIZEN) ?? sentence.match(CITIZENSHIP_REQUIRED)
    const exportControl = EXPORT_CONTROL.test(sentence)
    const person = sentence.match(US_PERSON)
    const requirement = REQUIREMENT.test(sentence)

    // "U.S. citizen or permanent resident" lets in green card holders: that's a U.S. person.
    if (citizen !== null && requirement && !preferred) {
      return flag(
        PERMANENT_RESIDENT.test(sentence) || person !== null
          ? 'us_person_required'
          : 'citizenship_required',
        citizen,
      )
    }
    if (person !== null && (requirement || exportControl)) {
      return flag('us_person_required', person)
    }
    if (exportControl && PERMANENT_RESIDENT.test(sentence) && requirement) {
      return flag('us_person_required', sentence.match(EXPORT_CONTROL))
    }
    const position = sentence.match(EXPORT_POSITION)
    if (position !== null) return flag('us_person_required', position, 1)
  }

  const exportLicenseOnly = EXPORT_LICENSE.test(sentence) && !VISA.test(sentence)
  if (!NOT_A_VISA.test(sentence) && !exportLicenseOnly) {
    for (const pattern of NO_SPONSORSHIP) {
      const match = sentence.match(pattern)
      if (match !== null) return flag('no_sponsorship', match)
    }
  }
  return null
}

/**
 * Restrictions a posting states, one per kind, each with the first sentence that says it. Rules
 * favor precision: a flag hides the role, so a mention needs a requirement word, and equal
 * opportunity boilerplate, questions, negations ("Required: No") and preferences are skipped.
 */
export function detectRestrictions(text: string): DescriptionFlag[] {
  const found = new Map<RestrictionKind, Found>()
  for (const sentence of splitSentences(text)) {
    const flag = restrictionIn(sentence)
    if (flag === null) continue
    const previous = found.get(flag.kind)
    if (previous === undefined || flag.strength > previous.strength) found.set(flag.kind, flag)
  }
  return RESTRICTION_KINDS.flatMap((kind) => {
    const flag = found.get(kind)
    return flag === undefined ? [] : [{ kind: flag.kind, quote: flag.quote }]
  })
}

/** The strongest flag, or null when there is none. `flags` must come from `detectRestrictions`. */
export function strongestFlag(flags: readonly DescriptionFlag[]): DescriptionFlag | null {
  return flags[0] ?? null
}

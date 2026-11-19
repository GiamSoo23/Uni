import { describe, expect, it } from 'vitest'
import {
  ADDEPAR,
  ANDURIL,
  ASTRANIS,
  BOOZ_ALLEN,
  CAPITAL_ONE,
  CLOUDFLARE,
  FLINT,
  HUNTINGTON_INGALLS,
  MARVELL,
  MUON_SPACE,
  RELIABLE_ROBOTICS,
  SCOUT_MOTORS,
  VERKADA,
} from '../test/description-fixtures'
import { detectRestrictions, MAX_QUOTE_LENGTH, strongestFlag } from './detector'

const strongest = (text: string) => strongestFlag(detectRestrictions(text))

describe('detectRestrictions on real postings', () => {
  it('flags Muon Space as U.S. person required and quotes the U.S. person sentence', () => {
    const flag = strongest(MUON_SPACE.text)
    expect(flag?.kind).toBe('us_person_required')
    expect(flag?.quote).toContain('applicant must either be (A) a U.S. person')
  })

  it('skips the equal opportunity sentence that lists citizenship', () => {
    const flags = detectRestrictions(MUON_SPACE.text)
    expect(flags.every((flag) => !flag.quote.includes('regardless of'))).toBe(true)
  })

  it('leaves Huntington Ingalls clear: "US Citizenship Required for this Position: No"', () => {
    expect(detectRestrictions(HUNTINGTON_INGALLS.text)).toEqual([])
  })

  it('flags the same form when it says Yes', () => {
    const text = HUNTINGTON_INGALLS.text.replace('Position: No', 'Position: Yes')
    expect(strongest(text)?.kind).toBe('citizenship_required')
  })

  it('flags Booz Allen as clearance required', () => {
    expect(strongest(BOOZ_ALLEN.text)).toEqual({
      kind: 'clearance_required',
      quote: 'Ability to obtain a Secret clearance',
    })
  })

  it('reads Anduril as U.S. person: its clearance "may be required depending on program"', () => {
    expect(strongest(ANDURIL.text)?.kind).toBe('us_person_required')
  })

  it('reads "citizenship, permanent residency, or asylee" as U.S. person', () => {
    expect(strongest(ASTRANIS.text)?.kind).toBe('us_person_required')
  })

  it.each([
    ['Flint', FLINT.text, 'We don’t sponsor visas for internships'],
    ['Scout Motors', SCOUT_MOTORS.text, 'or visa sponsorship for internship positions'],
    ['Addepar', ADDEPAR.text, 'without requiring current or future visa sponsorship'],
    ['Capital One', CAPITAL_ONE.text, 'will not sponsor a new applicant'],
  ])('flags %s as no sponsorship', (_company, text, quoted) => {
    const flag = strongest(text)
    expect(flag?.kind).toBe('no_sponsorship')
    expect(flag?.quote).toContain(quoted)
  })

  it.each([
    ['Verkada, which sponsors visas', VERKADA.text],
    ['Cloudflare, about export licenses', CLOUDFLARE.text],
    ['Marvell, whose export review allows a license', MARVELL.text],
    ['Reliable Robotics, which "may decline" a non-U.S. person', RELIABLE_ROBOTICS.text],
  ])('leaves %s clear', (_case, text) => {
    expect(detectRestrictions(text)).toEqual([])
  })
})

describe('detectRestrictions rules', () => {
  it.each([
    'Will you now or in the future require visa sponsorship?',
    'Active Secret clearance preferred.',
    'A security clearance is a plus.',
    'U.S. citizenship is not required for this role.',
    'Security Clearance: None',
    'We offer company-sponsored team events and hackathons.',
    'We not only offer great pay, but we also sponsor H-1B visas.',
    'Experience with customs clearance for international shipments.',
    'We serve millions of U.S. citizens every day.',
    'Join us and help us build the future.',
  ])('leaves "%s" clear', (text) => {
    expect(detectRestrictions(text)).toEqual([])
  })

  it.each([
    ['Must be a U.S. citizen.', 'citizenship_required'],
    ['US citizenship required.', 'citizenship_required'],
    ['Must be a U.S. citizen or permanent resident.', 'us_person_required'],
    ['All applicants must be U.S. persons within the meaning of ITAR.', 'us_person_required'],
    ['This role requires access to ITAR-controlled data.', 'us_person_required'],
    ['Candidates must be able to obtain a Top Secret clearance.', 'clearance_required'],
    ['Active TS/SCI clearance required.', 'clearance_required'],
    ['Visa sponsorship is not available for this position.', 'no_sponsorship'],
    ['IMMIGRATION SPONSORSHIP IS NOT AVAILABLE FOR THIS ROLE.', 'no_sponsorship'],
    ['We are unable to sponsor employment visas at this time.', 'no_sponsorship'],
    ['No visa sponsorship.', 'no_sponsorship'],
  ] as const)('flags "%s" as %s', (text, kind) => {
    expect(strongest(text)?.kind).toBe(kind)
  })

  it('returns one flag per kind, strongest first', () => {
    const flags = detectRestrictions(
      'We do not offer visa sponsorship. Must be a U.S. citizen. Must obtain a Secret clearance.',
    )
    expect(flags.map((flag) => flag.kind)).toEqual([
      'clearance_required',
      'citizenship_required',
      'no_sponsorship',
    ])
  })

  it('quotes the first sentence among equally explicit ones', () => {
    const flags = detectRestrictions('No visa sponsorship. We cannot sponsor visas.')
    expect(flags).toEqual([{ kind: 'no_sponsorship', quote: 'No visa sponsorship.' }])
  })

  it('shortens long sentences around the match', () => {
    const filler = 'This internship offers mentorship, projects and great teammates, '.repeat(8)
    const flag = strongest(`${filler}and applicants must be U.S. citizens, ${filler}end.`)
    expect(flag?.kind).toBe('citizenship_required')
    expect(flag?.quote.length).toBeLessThanOrEqual(MAX_QUOTE_LENGTH)
    expect(flag?.quote).toContain('must be U.S. citizens')
    expect(flag?.quote.startsWith('…')).toBe(true)
  })

  it('returns nothing for an empty description', () => {
    expect(detectRestrictions('')).toEqual([])
    expect(strongestFlag([])).toBeNull()
  })
})

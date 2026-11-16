import fc from 'fast-check'

import { normalizeCompanyName } from '../companies/policy'
import { COMPANIES_COLUMNS } from '../sheets/overrides'
import type { ApplicationRow, RawCell } from '../sheets/types'
import { isHttpUrl } from '../sheets/url'
import type { FakeSheetState, FakeTab } from './fake-gateway'
import { TRACKER_HEADER } from './sheets-fixtures'

/** The 14 Applications_Tab columns: the real Tracker header plus Job ID. */
export const ALL_APPLICATION_HEADERS = [...TRACKER_HEADER, 'Job ID'] as const

/** Uppercases each character with probability 1/2. Callers pass ASCII only. */
function arbRandomCase(value: string): fc.Arbitrary<string> {
  return fc
    .array(fc.boolean(), { minLength: value.length, maxLength: value.length })
    .map((flags) =>
      Array.from(value, (char, i) => (flags[i] === true ? char.toUpperCase() : char)).join(''),
    )
}

const arbHostLabel = fc.stringMatching(/^[a-z0-9]{1,10}$/)
const arbSafeToken = fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/)

/**
 * Absolute http(s) URLs made of characters the URL parser keeps as they are: random-case scheme
 * and host, an optional port, an optional path without a trailing slash, and optional query
 * parameters whose names are neither `ref` nor `utm_*`. No fragment and no leading `www.`, so
 * `addTrackingNoise` can add each kind of noise to any value.
 */
export const arbHttpUrl: fc.Arbitrary<string> = fc
  .record({
    scheme: fc.constantFrom('http', 'https').chain(arbRandomCase),
    labels: fc
      .array(arbHostLabel, { minLength: 1, maxLength: 3 })
      .filter((labels) => labels[0] !== 'www'),
    tld: fc.stringMatching(/^[a-z]{2,6}$/),
    port: fc.option(fc.integer({ min: 1, max: 65_535 }), { nil: null }),
    path: fc.array(arbSafeToken, { maxLength: 3 }),
    query: fc.array(
      fc.tuple(
        fc.stringMatching(/^[a-z]{1,6}$/).filter((name) => name !== 'ref'),
        fc.stringMatching(/^[a-z0-9]{0,6}$/),
      ),
      { maxLength: 3 },
    ),
  })
  .chain(({ scheme, labels, tld, port, path, query }) =>
    arbRandomCase([...labels, tld].join('.')).map((host) => {
      const portPart = port === null ? '' : `:${port}`
      const pathPart = path.map((segment) => `/${segment}`).join('')
      const queryPart =
        query.length === 0 ? '' : `?${query.map(([name, value]) => `${name}=${value}`).join('&')}`
      return `${scheme}://${host}${portPart}${pathPart}${queryPart}`
    }),
  )

/** Tracking noise that the URL_Normalizer must ignore (Requirement 6.7). */
export interface TrackingNoise {
  /** `utm_*` and `ref` parameters, each inserted at `position` modulo (current count + 1). */
  params: { name: string; value: string; position: number }[]
  /** Fragment to set, without the `#`; null for none. */
  fragment: string | null
  trailingSlash: boolean
  www: boolean
}

export const arbTrackingNoise: fc.Arbitrary<TrackingNoise> = fc.record({
  params: fc.array(
    fc.record({
      name: fc.oneof(
        fc.constant('ref'),
        fc.stringMatching(/^[a-z_]{0,10}$/).map((suffix) => `utm_${suffix}`),
      ),
      value: fc.string({ unit: 'grapheme', maxLength: 12 }),
      position: fc.nat({ max: 10 }),
    }),
    { maxLength: 4 },
  ),
  // The hash setter drops one leading '#', so a fragment of '#' alone would add nothing.
  fragment: fc.option(
    fc.string({ unit: 'grapheme', minLength: 1, maxLength: 12 }).filter((s) => !s.startsWith('#')),
    { nil: null },
  ),
  trailingSlash: fc.boolean(),
  www: fc.boolean(),
})

/** Applies `noise` to an http(s) URL such as one from `arbHttpUrl`. */
export function addTrackingNoise(url: string, noise: TrackingNoise): string {
  const parsed = new URL(url)
  if (noise.www) parsed.hostname = `www.${parsed.hostname}`
  if (noise.trailingSlash && !parsed.pathname.endsWith('/')) {
    parsed.pathname = `${parsed.pathname}/`
  }
  const params = parsed.search.length > 1 ? parsed.search.slice(1).split('&') : []
  for (const { name, value, position } of noise.params) {
    params.splice(position % (params.length + 1), 0, `${name}=${encodeURIComponent(value)}`)
  }
  parsed.search = params.length === 0 ? '' : `?${params.join('&')}`
  if (noise.fragment !== null) parsed.hash = noise.fragment
  return parsed.href
}

/** Link values that are not http(s): other schemes, relative paths and free text. */
const arbNonHttpLink: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    'mailto:jobs@example.com',
    'ftp://example.com/role.pdf',
    'javascript:alert(1)',
    'file:///etc/hosts',
    'data:text/plain,hi',
  ),
  arbSafeToken.map((token) => `/jobs/${token}`),
  arbHostLabel.map((label) => `${label}.com/careers`),
  arbHostLabel.map((label) => `//${label}.com/careers`),
  fc.string({ unit: 'grapheme', maxLength: 20 }),
)

const arbLinkValue: fc.Arbitrary<string> = fc.oneof(arbHttpUrl, arbNonHttpLink)

const arbWhitespace = fc.constantFrom('', ' ', '  ', '\t', '\n', ' \u00a0')

/**
 * Raw_Cells whose hyperlink, text format run links and displayed text are each drawn from http(s)
 * URLs, other schemes, relative paths and noise. Run links have distinct start indexes and come in
 * random order. The text may carry surrounding whitespace.
 */
export const arbRawCell: fc.Arbitrary<RawCell> = fc.record({
  text: fc.oneof(
    fc.constant(''),
    fc
      .tuple(arbWhitespace, arbLinkValue, arbWhitespace)
      .map(([before, value, after]) => `${before}${value}${after}`),
  ),
  hyperlink: fc.option(arbLinkValue, { nil: null }),
  runLinks: fc.uniqueArray(fc.record({ startIndex: fc.nat({ max: 200 }), uri: arbLinkValue }), {
    selector: (run) => run.startIndex,
    maxLength: 3,
  }),
})

/** Prefixes that the Row_Serializer escapes with an apostrophe (Requirement 4.3). */
const FORMULA_PREFIXES = ['=', '+', '-', '@', "'", "''", '=SUM(A1:A2)', '=HYPERLINK("x")'] as const

/** Field text with no surrounding whitespace: ASCII, full Unicode and formula-like prefixes. */
const arbFieldText: fc.Arbitrary<string> = fc
  .oneof(
    fc.constant(''),
    fc.string({ maxLength: 30 }),
    fc.string({ unit: 'grapheme', maxLength: 30 }),
    fc.string({ unit: 'binary', maxLength: 30 }),
    fc
      .tuple(fc.constantFrom(...FORMULA_PREFIXES), fc.string({ unit: 'grapheme', maxLength: 20 }))
      .map(([prefix, rest]) => `${prefix}${rest}`),
  )
  .map((value) => value.trim())

const arbLink: fc.Arbitrary<Pick<ApplicationRow, 'linkText' | 'linkUrl'>> = fc.oneof(
  arbHttpUrl.map((url) => ({ linkText: url, linkUrl: url })),
  fc
    .oneof(
      arbFieldText,
      arbNonHttpLink.map((value) => value.trim()),
    )
    .filter((text) => !isHttpUrl(text))
    .map((text) => ({ linkText: text, linkUrl: null })),
)

const arbJobId: fc.Arbitrary<string | null> = fc.option(
  fc.oneof(
    fc.uuid().map((id) => `simplify:${id}`),
    arbFieldText.filter((value) => value !== ''),
  ),
  { nil: null },
)

/**
 * Application_Rows that meet the round-trip conditions of Requirement 4.4: Company or Role is
 * non-empty; the link text equals the link URL, or the URL is null and the text is not an http(s)
 * URL; no field has surrounding whitespace; fields stay far below 50,000 characters; the Job ID is
 * null or non-empty. Text includes formula-like prefixes and Unicode.
 */
export const arbApplicationRow: fc.Arbitrary<ApplicationRow> = fc
  .record({
    rowNumber: fc.integer({ min: 2, max: 10_000 }),
    company: arbFieldText,
    role: arbFieldText,
    link: arbLink,
    dateApplied: arbFieldText,
    status: arbFieldText,
    appNumber: arbFieldText,
    location: arbFieldText,
    industry: arbFieldText,
    resumeVersion: arbFieldText,
    responseDate: arbFieldText,
    nextStep: arbFieldText,
    nextStepDate: arbFieldText,
    notes: arbFieldText,
    jobId: arbJobId,
  })
  .filter(({ company, role }) => company !== '' || role !== '')
  .map(({ link, ...fields }) => ({ ...fields, ...link }))

/** A permutation of the 14 Applications_Tab column names, Job ID included (Requirement 4.5). */
export const arbHeaderPermutation: fc.Arbitrary<string[]> = fc.shuffledSubarray(
  [...ALL_APPLICATION_HEADERS],
  { minLength: ALL_APPLICATION_HEADERS.length, maxLength: ALL_APPLICATION_HEADERS.length },
)

const arbSeparator = fc.stringMatching(/^[ \t.,&()/-]{1,3}$/)
const arbEdge = fc.stringMatching(/^[ \t.,]{0,2}$/)

/**
 * Spellings of `company` that `normalizeCompanyName` maps to the same key: random case, random
 * punctuation and whitespace between words, and punctuation or whitespace around the name.
 */
export function arbCompanyVariant(company: string): fc.Arbitrary<string> {
  const words = normalizeCompanyName(company).split(' ').filter(Boolean)
  return fc
    .tuple(
      fc.tuple(...words.map(arbRandomCase)),
      fc.array(arbSeparator, { minLength: words.length, maxLength: words.length }),
      arbEdge,
      arbEdge,
    )
    .map(([casedWords, separators, before, after]) => {
      const body = casedWords.map((word, i) => (i === 0 ? word : `${separators[i] ?? ' '}${word}`))
      return `${before}${body.join('')}${after}`
    })
}

/** Title of the applications tab in `arbSheetState`, the default Applications_Tab name. */
export const APPLICATIONS_TAB_TITLE = 'Tracker'
/** Spellings of the Job ID header that the Header_Map matches. */
export const JOB_ID_HEADER_VARIANTS = ['Job ID', ' job id ', 'JOB ID', 'job ID  '] as const
/** Spellings of the Companies tab title that Sheet_Setup matches. */
export const COMPANIES_TITLE_VARIANTS = ['Companies', ' companies', 'COMPANIES '] as const
/** The owner's other tabs, which Uni must never read or write (Requirement 13.8). */
export const OTHER_TAB_TITLES = [
  'SHPE 2026',
  'SHPE 2026 Agenda',
  'SHPE 2026 Exhibitors',
  'Summary',
] as const

type TabWithoutId = Omit<FakeTab, 'sheetId'>

const COLUMN = {
  company: 0,
  role: 1,
  link: 2,
  dateApplied: 3,
  status: 4,
  industry: 7,
  notes: 12,
  jobId: 13,
} as const

/** Displayed text, including free-text dates and values that look like formulas. */
const arbDisplay: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.string({ unit: 'grapheme', maxLength: 12 }),
  fc.constantFrom('=SUM(A1:A2)', "'quoted", '+1', 'sept 7', 'ago 17, 2026'),
)

/** Drops trailing '' cells, as rows typed in the Sheet come back from the API. */
function trimTrailing(values: string[]): string[] {
  let end = values.length
  while (end > 0 && values[end - 1] === '') end -= 1
  return values.slice(0, end)
}

function placeCells(cells: Partial<Record<keyof typeof COLUMN, string>>): string[] {
  const values = Array.from({ length: ALL_APPLICATION_HEADERS.length }, () => '')
  for (const field of Object.keys(COLUMN) as (keyof typeof COLUMN)[]) {
    const value = cells[field]
    if (value !== undefined) values[COLUMN[field]] = value
  }
  return trimTrailing(values)
}

function arbApplicationCells(withJobId: boolean): fc.Arbitrary<string[]> {
  return fc
    .record({
      company: fc.constantFrom('Acme', 'Globex', 'Initech', 'Intercontinental Exchange', ''),
      role: fc.constantFrom('Software Engineer Intern', 'Data Science Intern', ''),
      link: fc.oneof(arbHttpUrl, arbDisplay),
      dateApplied: arbDisplay,
      status: fc.constantFrom('Submitted', 'Rejected', 'OA', 'NO ROLE', 'Not Started', ''),
      industry: fc.constantFrom('Fintech', 'Retail', ''),
      notes: arbDisplay,
      jobId: withJobId
        ? fc.option(
            fc.uuid().map((id) => `simplify:${id}`),
            { nil: '' },
          )
        : fc.constant(''),
    })
    .filter(({ company, role }) => company !== '' || role !== '')
    .map(placeCells)
}

/** Company and Role empty, Notes not empty (Glossary: Spillover_Row). */
const arbSpilloverCells: fc.Arbitrary<string[]> = fc
  .tuple(
    arbDisplay.filter((notes) => notes.trim() !== ''),
    arbDisplay,
  )
  .map(([notes, dateApplied]) => placeCells({ dateApplied, notes }))

function arbDataRow(withJobId: boolean): fc.Arbitrary<string[]> {
  return fc.oneof(
    { weight: 4, arbitrary: arbApplicationCells(withJobId) },
    { weight: 1, arbitrary: arbSpilloverCells },
    { weight: 1, arbitrary: fc.constant<string[]>([]) },
  )
}

function arbTrailingEmptyRows(width: number): fc.Arbitrary<string[][]> {
  return fc.array(
    fc.integer({ min: 0, max: width }).map((length) => Array.from({ length }, () => '')),
    { maxLength: 3 },
  )
}

const arbApplicationsTab: fc.Arbitrary<TabWithoutId> = fc
  .record({
    jobIdHeader: fc.option(fc.constantFrom(...JOB_ID_HEADER_VARIANTS), { nil: null }),
    emptyHeaders: fc.nat({ max: 3 }),
    spareRows: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 20 })),
    spareColumns: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 13 })),
  })
  .chain(({ jobIdHeader, emptyHeaders, spareRows, spareColumns }) => {
    const header: string[] = [
      ...TRACKER_HEADER,
      ...(jobIdHeader === null ? [] : [jobIdHeader]),
      ...Array.from({ length: emptyHeaders }, () => ''),
    ]
    return fc
      .tuple(
        fc.array(arbDataRow(jobIdHeader !== null), { maxLength: 8 }),
        arbTrailingEmptyRows(header.length),
      )
      .map(([data, trailing]) => {
        const rows = [header, ...data, ...trailing]
        return {
          title: APPLICATIONS_TAB_TITLE,
          rowCount: rows.length + spareRows,
          columnCount: header.length + spareColumns,
          rows,
        }
      })
  })

const arbCompaniesTab: fc.Arbitrary<TabWithoutId> = fc
  .record({
    title: fc.constantFrom(...COMPANIES_TITLE_VARIANTS),
    data: fc.array(
      fc.tuple(
        fc.constantFrom('Acme', 'Globex', 'Initech'),
        fc.constantFrom('no_sponsorship', 'offers sponsorship', 'unknown policy'),
        fc.constantFrom('', 'US only'),
        arbDisplay,
        fc.oneof(fc.constant(''), arbHttpUrl),
        fc.constantFrom('2026-11-12', 'Nov 12, 2026', ''),
      ),
      { maxLength: 3 },
    ),
    spareRows: fc.nat({ max: 20 }),
    spareColumns: fc.nat({ max: 3 }),
  })
  .map(({ title, data, spareRows, spareColumns }) => {
    const rows = [[...COMPANIES_COLUMNS], ...data.map((values) => trimTrailing([...values]))]
    return {
      title,
      rowCount: rows.length + spareRows,
      columnCount: COMPANIES_COLUMNS.length + spareColumns,
      rows,
    }
  })

function arbOtherTab(title: string): fc.Arbitrary<TabWithoutId> {
  return fc
    .record({
      rows: fc.array(fc.array(arbDisplay, { minLength: 1, maxLength: 4 }), {
        minLength: 1,
        maxLength: 3,
      }),
      spareRows: fc.nat({ max: 10 }),
    })
    .map(({ rows, spareRows }) => ({
      title,
      rowCount: rows.length + spareRows,
      columnCount: 4,
      rows,
    }))
}

const arbOtherTabs: fc.Arbitrary<TabWithoutId[]> = fc
  .subarray([...OTHER_TAB_TITLES])
  .chain((titles) => fc.tuple(...titles.map(arbOtherTab)))

/**
 * Fake Sheets for `InMemorySheetsGateway`, in random tab order with distinct sheet ids:
 * - a "Tracker" tab with the real header, with or without a Job ID variant and 0 to 3 trailing
 *   empty header cells; data rows mixing applications, Spillover_Rows and empty rows; 0 to 3
 *   trailing empty rows; a grid that is full or has spare rows and columns;
 * - a Companies tab with a title variant, or none;
 * - any subset of "SHPE 2026", "SHPE 2026 Agenda", "SHPE 2026 Exhibitors" and "Summary".
 */
export const arbSheetState: fc.Arbitrary<FakeSheetState> = fc
  .tuple(arbApplicationsTab, fc.option(arbCompaniesTab, { nil: null }), arbOtherTabs)
  .chain(([applications, companies, others]) => {
    const tabs = [applications, ...(companies === null ? [] : [companies]), ...others]
    return fc
      .uniqueArray(fc.integer({ min: 0, max: 2_147_483_647 }), {
        minLength: tabs.length,
        maxLength: tabs.length,
      })
      .chain((ids) => {
        const withIds = tabs.map((tab, i) => ({ ...tab, sheetId: ids[i] ?? i }))
        return fc.shuffledSubarray(withIds, { minLength: tabs.length, maxLength: tabs.length })
      })
      .map((ordered) => ({ tabs: ordered }))
  })

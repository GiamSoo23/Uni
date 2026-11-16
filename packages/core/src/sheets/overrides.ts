import {
  COMPANY_POLICIES,
  type CompanyPolicy,
  type CompanyPolicyKind,
  companyPolicySchema,
  normalizeCompanyName,
} from '../companies/policy'
import { isIsoCalendarDate } from './dates'
import { type HeaderMap, buildHeaderMap, missingColumns, normalizeHeader } from './header'
import type { Grid, OverrideSkipReason, RawCell, SheetIssue } from './types'
import { isHttpUrl } from './url'

/** The Companies_Tab columns, in the order Sheet_Setup writes them (Requirement 11.1). */
export const COMPANIES_COLUMNS = [
  'Company',
  'Policy',
  'Scope',
  'Note',
  'Evidence URL',
  'Checked',
] as const

/** Columns the Companies_Tab must have for any override to be read (Requirement 11.2). */
export const REQUIRED_COMPANIES_HEADERS = ['Company', 'Policy', 'Note', 'Checked'] as const

const NOTE_MIN_LENGTH = 10
const NOTE_MAX_LENGTH = 300
/** At most this many row numbers are listed in the skipped-row summary (Requirement 11.14). */
export const SUMMARY_ROW_LIMIT = 20

/**
 * Reads a Policy cell (Requirement 11.3): trimmed, lowercased and with each space turned into an
 * underscore, so "No Sponsorship" is `no_sponsorship`. Any other value gives null.
 */
export function parsePolicyValue(value: string): CompanyPolicyKind | null {
  const key = value.trim().toLowerCase().replaceAll(' ', '_')
  return COMPANY_POLICIES.find((kind) => kind === key) ?? null
}

export interface ParsedCompanies {
  /** Company overrides with `source: 'sheet'`, one per normalized company, in sheet row order. */
  overrides: CompanyPolicy[]
  issues: SheetIssue[]
}

type CompaniesColumn = (typeof COMPANIES_COLUMNS)[number]

/**
 * Parses the Companies_Tab grid, whose row 0 is the header (Requirement 11). A missing tab or a
 * header-only tab gives nothing (11.12). Missing required headers give one `companies_header` issue
 * and no overrides (11.2). Each other row becomes an override that passed `companyPolicySchema`
 * (11.4, 11.11), an `override_row` issue naming the first failing rule (11.6), or nothing when all
 * its cells are empty (11.7). When normalized companies collide, the highest row wins and one
 * `duplicate_company` issue lists the other rows (11.8).
 */
export function parseCompaniesTab(grid: Grid | null): ParsedCompanies {
  if (grid === null || grid.length <= 1) return { overrides: [], issues: [] }
  const map = buildHeaderMap((grid[0] ?? []).map((cell) => cell.text))
  const missing = missingColumns(map, REQUIRED_COMPANIES_HEADERS)
  if (missing.length > 0) {
    return { overrides: [], issues: [{ type: 'companies_header', missing }] }
  }

  const issues: SheetIssue[] = []
  const parsed: { row: number; policy: CompanyPolicy }[] = []
  grid.forEach((cells, index) => {
    if (index === 0) return
    const row = index + 1
    const result = parseCompanyRow(cells, map)
    if (result === null) return
    if (typeof result === 'string') issues.push({ type: 'override_row', row, reason: result })
    else parsed.push({ row, policy: result })
  })

  const byCompany = new Map<string, { row: number; policy: CompanyPolicy }[]>()
  for (const entry of parsed) {
    const key = normalizeCompanyName(entry.policy.company)
    const group = byCompany.get(key)
    if (group === undefined) byCompany.set(key, [entry])
    else group.push(entry)
  }

  const kept: { row: number; policy: CompanyPolicy }[] = []
  for (const group of byCompany.values()) {
    // Rows were visited in ascending order, so the last entry has the highest row.
    const winner = group[group.length - 1]
    if (winner === undefined) continue
    kept.push(winner)
    if (group.length > 1) {
      issues.push({
        type: 'duplicate_company',
        company: winner.policy.company,
        keptRow: winner.row,
        skippedRows: group.slice(0, -1).map((entry) => entry.row),
      })
    }
  }
  kept.sort((a, b) => a.row - b.row)
  return { overrides: kept.map((entry) => entry.policy), issues }
}

/**
 * One data row: null when every Companies_Tab cell is empty, the skip reason of the first failing
 * rule of 11.4 to 11.6, or the override built by `companyPolicySchema`.
 */
function parseCompanyRow(
  cells: readonly RawCell[],
  map: HeaderMap,
): CompanyPolicy | OverrideSkipReason | null {
  const textOf = (header: CompaniesColumn): string => {
    const column = map.index.get(normalizeHeader(header))
    return column === undefined ? '' : (cells[column]?.text.trim() ?? '')
  }
  const company = textOf('Company')
  const policyText = textOf('Policy')
  const scope = textOf('Scope')
  const note = textOf('Note')
  const evidenceUrl = textOf('Evidence URL')
  const checked = textOf('Checked')
  if ([company, policyText, scope, note, evidenceUrl, checked].every((text) => text === '')) {
    return null
  }

  if (company === '') return 'empty_company'
  const policy = parsePolicyValue(policyText)
  if (policy === null) return 'unknown_policy'
  if (note.length < NOTE_MIN_LENGTH || note.length > NOTE_MAX_LENGTH) return 'note_length'
  if (evidenceUrl !== '' && !isHttpUrl(evidenceUrl)) return 'evidence_url'
  if (!isIsoCalendarDate(checked)) return 'checked_date'

  const result = companyPolicySchema.safeParse({
    company,
    aliases: [],
    policy,
    ...(scope === '' ? {} : { scope }),
    source: 'sheet',
    evidence: [
      {
        quote: note,
        ...(evidenceUrl === '' ? {} : { url: evidenceUrl }),
        checkedAt: checked,
      },
    ],
  })
  return result.success ? result.data : 'schema'
}

export interface OverrideIssueSummary {
  /** Number of distinct skipped Companies_Tab rows. */
  count: number
  /** The first 20 skipped row numbers, ascending. */
  rows: number[]
  /** How many skipped rows are not listed in `rows`. */
  remaining: number
}

/**
 * The skipped-row summary of Requirement 11.14, from `override_row` and `duplicate_company`
 * issues: distinct row numbers in ascending order, the first 20 listed and the rest counted.
 */
export function summarizeOverrideIssues(issues: readonly SheetIssue[]): OverrideIssueSummary {
  const skipped = new Set<number>()
  for (const issue of issues) {
    if (issue.type === 'override_row') skipped.add(issue.row)
    else if (issue.type === 'duplicate_company')
      issue.skippedRows.forEach((row) => skipped.add(row))
  }
  const sorted = [...skipped].sort((a, b) => a - b)
  return {
    count: sorted.length,
    rows: sorted.slice(0, SUMMARY_ROW_LIMIT),
    remaining: Math.max(0, sorted.length - SUMMARY_ROW_LIMIT),
  }
}

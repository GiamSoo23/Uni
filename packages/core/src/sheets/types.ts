import type { CompanyPolicy } from '../companies/policy'

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export type FailureCategory =
  'permission_denied' | 'not_found' | 'rate_limited' | 'network' | 'invalid_sheet'

export interface SheetsFailure {
  category: FailureCategory
  /** HTTP status of the last attempt; null for connection errors and timeouts. */
  httpStatus: number | null
  /** Google's error status/reason (e.g. "PERMISSION_DENIED") or a Uni reason such as "missing_columns". */
  reason: string
  /** Safe detail for the UI: missing column names, configured tab name. Never secrets. */
  detail?: string
}

/** One cell as the API returns it (Glossary: Raw_Cell). */
export interface RawCell {
  /** formattedValue, '' when absent. */
  text: string
  /** CellData.hyperlink. */
  hyperlink: string | null
  /** textFormatRuns[].format.link.uri. */
  runLinks: { startIndex: number; uri: string }[]
}

/** Rows as returned, row 0 is sheet row 1. Rows and cells may be ragged. */
export type Grid = readonly (readonly RawCell[])[]

/** One parsed row of the Applications tab. All strings are trimmed displayed text (3.8). */
export interface ApplicationRow {
  /** 1-based sheet row; the header is row 1 (3.11). */
  rowNumber: number
  company: string
  role: string
  /** Displayed text of the Link cell, trimmed. */
  linkText: string
  /** Resolved http(s) URL or null. */
  linkUrl: string | null
  /** Free text, e.g. "sept 7", "ago 17, 2026". */
  dateApplied: string
  status: string
  appNumber: string
  location: string
  industry: string
  resumeVersion: string
  responseDate: string
  nextStep: string
  nextStepDate: string
  notes: string
  jobId: string | null
}

export type OverrideSkipReason =
  'empty_company' | 'unknown_policy' | 'note_length' | 'evidence_url' | 'checked_date' | 'schema'

export type SheetIssue =
  | { type: 'duplicate_job_id'; jobId: string; rows: number[] }
  | { type: 'companies_header'; missing: string[] }
  | { type: 'override_row'; row: number; reason: OverrideSkipReason }
  | { type: 'duplicate_company'; company: string; keptRow: number; skippedRows: number[] }

export interface SheetSnapshot {
  applications: ApplicationRow[]
  /** Company overrides with source: 'sheet'. */
  overrides: CompanyPolicy[]
  issues: SheetIssue[]
}

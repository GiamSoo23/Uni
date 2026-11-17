import { summarizeOverrideIssues, type SheetIssue, type SheetsFailure } from '@uni/core'
import { formatDateTime } from '@/lib/format'
import type { SheetState } from '@/lib/sheets/snapshot-cache'

export type SheetMessageTone = 'info' | 'warning'

export interface SheetMessage {
  tone: SheetMessageTone
  text: string
}

/**
 * One sentence per failure category (2.4), with a hint to fix it. `clientEmail` is shown only
 * for `permission_denied` (2.5). Details come from `SheetsFailure.detail`, which holds tab or
 * column names and never a secret.
 */
export function failureText(failure: SheetsFailure, clientEmail?: string): string {
  switch (failure.category) {
    case 'permission_denied':
      return clientEmail === undefined
        ? 'Google denied access to your Sheet (permission_denied).'
        : `Google denied access to your Sheet (permission_denied). Share the Sheet with ${clientEmail} as an Editor, and check that its key is still active.`
    case 'not_found':
      return 'Your Sheet was not found (not_found). Check UNI_SHEET_ID.'
    case 'rate_limited':
      return 'Google Sheets is rate limiting Uni (rate_limited). Try again in a minute.'
    case 'network':
      return 'Couldn’t reach Google Sheets (network). Try again in a moment.'
    case 'invalid_sheet':
      return invalidSheetText(failure)
  }
}

function invalidSheetText(failure: SheetsFailure): string {
  switch (failure.reason) {
    case 'missing_tab':
      return `Your Sheet has no tab named “${failure.detail ?? ''}” (invalid_sheet). Rename the tab or set UNI_SHEET_TAB.`
    case 'missing_columns':
      return `Your applications tab is missing these columns: ${failure.detail ?? ''} (invalid_sheet).`
    case 'cell_too_long':
      return `A value for ${failure.detail ?? 'a column'} is longer than Google Sheets allows (invalid_sheet).`
    default:
      return 'Google Sheets didn’t accept the request or sent an unexpected answer (invalid_sheet).'
  }
}

function issueMessages(issues: readonly SheetIssue[]): SheetMessage[] {
  const messages: SheetMessage[] = []
  for (const issue of issues) {
    if (issue.type === 'duplicate_job_id') {
      messages.push({
        tone: 'warning',
        text: `Job ID ${issue.jobId} appears in rows ${listRows(issue.rows)} of your Sheet. Undo won’t delete either row until only one is left.`,
      })
    } else if (issue.type === 'companies_header') {
      messages.push({
        tone: 'warning',
        text: `The Companies tab is missing these columns: ${issue.missing.join(', ')}. Its rows were ignored.`,
      })
    }
  }
  const skipped = summarizeOverrideIssues(issues)
  if (skipped.count > 0) {
    const rows = skipped.rows.join(', ')
    const more = skipped.remaining > 0 ? ` and ${skipped.remaining} more` : ''
    const noun = skipped.count === 1 ? 'row' : 'rows'
    messages.push({
      tone: 'info',
      text: `Skipped ${skipped.count} ${noun} of the Companies tab: ${rows}${more}. Check the Policy, Evidence URL and Checked columns, and look for repeated companies.`,
    })
  }
  return messages
}

function listRows(rows: readonly number[]): string {
  if (rows.length <= 1) return rows.join('')
  return `${rows.slice(0, -1).join(', ')} and ${rows.at(-1)}`
}

/**
 * The notices above the job list. Disabled mode names the variables only (2.1). A failure names
 * one category and says what the list falls back to (2.2, 2.3). Parse issues follow (3.13, 11.14).
 */
export function sheetMessages(state: SheetState): SheetMessage[] {
  if (state.mode === 'disabled') {
    const problems = state.problems.map(({ kind, name }) => `${kind} ${name}`).join('; ')
    return [
      {
        tone: 'info',
        text: `Google Sheet not connected: ${problems}. Roles you applied to aren’t hidden. See docs/SHEETS.md.`,
      },
    ]
  }

  const messages: SheetMessage[] = []
  if (state.failure !== null) {
    const fallback =
      state.readAt === null
        ? 'Showing every role without your Sheet.'
        : `Showing your Sheet as of ${formatDateTime(state.readAt)}.`
    messages.push({
      tone: 'warning',
      text: `${failureText(state.failure, state.clientEmail)} ${fallback}`,
    })
  }
  if (state.snapshot !== null) messages.push(...issueMessages(state.snapshot.issues))
  return messages
}

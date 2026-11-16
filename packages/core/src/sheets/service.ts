import type { Job } from '../jobs/job'
import { buildAppliedRow } from './append'
import type { SheetsSettings } from './config'
import { formatDateApplied, todayIn } from './dates'
import type { SheetsGateway, TabInfo, WriteOp } from './gateway'
import { buildHeaderMap, normalizeHeader } from './header'
import { createKeyedMutex } from './keyed-mutex'
import { jobIdFor } from './matcher'
import { parseApplicationsTab } from './row-parser'
import { serializeApplicationRow } from './row-serializer'
import { planSetup } from './setup'
import type { ApplicationRow, Grid, SheetsFailure } from './types'

export interface SheetsServiceDeps {
  gateway: SheetsGateway
  settings: SheetsSettings
  now: () => Date
  /** A candidate id for a new Companies tab. Ids already in use are skipped. */
  randomSheetId: () => number
  /** Called after every successful write; clears the Sheet_Cache (12.4). */
  onWrite: () => void
}

export type MarkResult =
  | { kind: 'success'; jobId: string }
  | { kind: 'already_recorded'; jobId: string; status: string }
  | { kind: 'error'; failure: SheetsFailure }

export type UndoResult =
  | { kind: 'success'; jobId: string }
  | { kind: 'error'; failure: SheetsFailure }
  | { kind: 'not_unique'; jobId: string; found: number }

export interface SheetsService {
  markAsApplied(job: Job): Promise<MarkResult>
  undoMarkAsApplied(jobId: string): Promise<UndoResult>
}

/**
 * Mark as applied and Undo against a `SheetsGateway`. Both run inside one keyed mutex, so calls
 * for the same Job_ID are handled one at a time in arrival order (10.3). Each call locates rows
 * with a fresh read, never with cached row numbers (10.1, 10.10, 13.7).
 */
export function createSheetsService(deps: SheetsServiceDeps): SheetsService {
  const { gateway, settings } = deps
  const mutex = createKeyedMutex()

  async function mark(job: Job): Promise<MarkResult> {
    const jobId = jobIdFor(job)

    const tabs = await gateway.listTabs()
    if (!tabs.ok) return error(tabs.error)
    const key = normalizeHeader(settings.applicationsTab)
    const appTab = tabs.value.find((tab) => normalizeHeader(tab.title) === key)
    if (appTab === undefined) return error(missingTab(settings.applicationsTab))

    const fresh = await gateway.readApplicationsFresh(appTab.title)
    if (!fresh.ok) return error(fresh.error)
    const parsed = parseApplicationsTab(fresh.value.grid)
    if (!parsed.ok) return error(parsed.error)

    const recorded = highestRow(parsed.value.rows.filter((row) => row.jobId === jobId))
    if (recorded !== null) return { kind: 'already_recorded', jobId, status: recorded.status }

    const { tab, grid } = fresh.value
    const setup = planSetup(
      tabs.value,
      buildHeaderMap((grid[0] ?? []).map((cell) => cell.text)),
      tab,
      newSheetId(tabs.value, deps.randomSheetId),
    )
    const row = buildAppliedRow({
      job,
      today: formatDateApplied(todayIn(settings.timeZone, deps.now())),
      resumeVersion: settings.resumeVersion,
      rows: parsed.value.rows,
    })
    const cells = serializeApplicationRow(row, setup.header)
    if (!cells.ok) {
      return error({
        category: 'invalid_sheet',
        httpStatus: null,
        reason: 'cell_too_long',
        detail: cells.error.column,
      })
    }

    const rowIndex = lastNonEmptyRowIndex(grid) + 1
    const insert: WriteOp = {
      type: 'insertRow',
      sheetId: tab.sheetId,
      rowIndex,
      cells: cells.value,
      appendAtEnd: rowIndex >= tab.rowCount,
    }
    const written = await gateway.applyBatch([...setup.ops, insert])
    if (!written.ok) return error(written.error)
    deps.onWrite()
    return { kind: 'success', jobId }
  }

  async function undo(jobId: string): Promise<UndoResult> {
    const fresh = await gateway.readApplicationsFresh(settings.applicationsTab)
    if (!fresh.ok) return error(fresh.error)
    const parsed = parseApplicationsTab(fresh.value.grid)
    if (!parsed.ok) return error(parsed.error)

    const owned = parsed.value.rows.filter((row) => row.jobId === jobId)
    const [target] = owned
    if (owned.length !== 1 || target === undefined) {
      return { kind: 'not_unique', jobId, found: owned.length }
    }
    const written = await gateway.applyBatch([
      { type: 'deleteRow', sheetId: fresh.value.tab.sheetId, rowIndex: target.rowNumber - 1 },
    ])
    if (!written.ok) return error(written.error)
    deps.onWrite()
    return { kind: 'success', jobId }
  }

  return {
    markAsApplied: (job) => mutex.run(jobIdFor(job), () => mark(job)),
    undoMarkAsApplied: (jobId) => mutex.run(jobId, () => undo(jobId)),
  }
}

function error(failure: SheetsFailure): { kind: 'error'; failure: SheetsFailure } {
  return { kind: 'error', failure }
}

function missingTab(title: string): SheetsFailure {
  return { category: 'invalid_sheet', httpStatus: null, reason: 'missing_tab', detail: title }
}

function highestRow(rows: readonly ApplicationRow[]): ApplicationRow | null {
  let best: ApplicationRow | null = null
  for (const row of rows) if (best === null || row.rowNumber > best.rowNumber) best = row
  return best
}

/**
 * 0-based index of the last row with at least one non-empty cell, counting Spillover_Rows (8.10).
 * A cell holding only whitespace counts as non-empty, so the new row never lands above it.
 */
function lastNonEmptyRowIndex(grid: Grid): number {
  for (let index = grid.length - 1; index >= 0; index -= 1) {
    if (grid[index]?.some((cell) => cell.text !== '') === true) return index
  }
  return 0
}

/** The random candidate, or the next unused id after it when tabs already use it. */
function newSheetId(tabs: readonly TabInfo[], random: () => number): number {
  const used = new Set(tabs.map((tab) => tab.sheetId))
  const candidate = Math.trunc(random())
  let id = Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : 0
  while (used.has(id)) id += 1
  return id
}

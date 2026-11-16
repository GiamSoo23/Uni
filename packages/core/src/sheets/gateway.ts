import type { Grid, Result, SheetsFailure } from './types'

/** Metadata of one tab of the Sheet. No cell data. */
export interface TabInfo {
  sheetId: number
  title: string
  rowCount: number
  columnCount: number
}

/**
 * One write in a `batchUpdate`. Rows and columns are 0-based grid indexes.
 * `deleteRow` goes through `applyBatch` too, so the port has a single write method.
 */
export type WriteOp =
  | { type: 'addTab'; title: 'Companies'; sheetId: number; headers: readonly string[] }
  | { type: 'setHeader'; sheetId: number; column: number; text: 'Job ID'; growColumnsTo?: number }
  | {
      type: 'insertRow'
      sheetId: number
      rowIndex: number
      cells: readonly string[]
      appendAtEnd: boolean
    }
  | { type: 'deleteRow'; sheetId: number; rowIndex: number }

export interface FreshApplications {
  tab: TabInfo
  /** Formatted values only, as a Grid with no links. */
  grid: Grid
}

/** What Uni needs from a spreadsheet backend, in domain terms. */
export interface SheetsGateway {
  /** Applications tab + Companies tab (if present) with links. One request in the steady state. */
  readSnapshot(
    applicationsTab: string,
  ): Promise<Result<{ applications: Grid; companies: Grid | null; tabs: TabInfo[] }, SheetsFailure>>
  /** Tab metadata only: titles, ids, grid sizes. No cell data. */
  listTabs(): Promise<Result<TabInfo[], SheetsFailure>>
  /** Fresh formatted values of the applications tab, never cached. */
  readApplicationsFresh(applicationsTab: string): Promise<Result<FreshApplications, SheetsFailure>>
  /** One atomic batchUpdate. */
  applyBatch(ops: readonly WriteOp[]): Promise<Result<void, SheetsFailure>>
}

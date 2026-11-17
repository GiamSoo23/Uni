import 'server-only'
import type {
  FreshApplications,
  Grid,
  Result,
  SheetsFailure,
  SheetsGateway,
  TabInfo,
  WriteOp,
} from '@uni/core'
import { z } from 'zod'
import {
  consoleLogger,
  defaultSleep,
  RANGE_PARSE_REASON,
  sheetsRequest,
  type Logger,
  type SheetsEndpoint,
  type SheetsRequestDeps,
} from '@/lib/sheets/http'
import { spreadsheetSchema, toGrid, type SpreadsheetSheet } from '@/lib/sheets/schemas'
import type { AccessTokenProvider } from '@/lib/sheets/token'

// The `fields` masks of the design's "Sheets API calls" table. Responses carry nothing else.
const PROPERTIES = 'properties(sheetId,title,gridProperties(rowCount,columnCount))'
export const SNAPSHOT_FIELDS = `sheets(${PROPERTIES},data(rowData(values(formattedValue,hyperlink,textFormatRuns(startIndex,format(link(uri)))))))`
export const TABS_FIELDS = `sheets.${PROPERTIES}`
export const FRESH_FIELDS = `sheets(${PROPERTIES},data(rowData(values(formattedValue))))`

export const COMPANIES_TAB = 'Companies'
/** Grid size of the Companies tab created by `addTab`. */
export const NEW_TAB_ROWS = 1000
export const NEW_TAB_COLUMNS = 6

const batchResponseSchema = z.object({ replies: z.array(z.unknown()).optional() })

/** A tab name as an A1 range: wrapped in single quotes, with inner quotes doubled. */
export function quoteSheetName(title: string): string {
  return `'${title.replaceAll("'", "''")}'`
}

export type CellData = { userEnteredValue: { stringValue: string } } | Record<string, never>

/**
 * A serialized value as a `stringValue` cell. Only `escapeCell` can put an apostrophe at the
 * start of a value, so removing one leading apostrophe restores the text exactly. A
 * `stringValue` is never parsed as a formula or number. Empty values are empty cells.
 */
export function stringCell(value: string): CellData {
  if (value === '') return {}
  return { userEnteredValue: { stringValue: value.startsWith("'") ? value.slice(1) : value } }
}

const normalizeTitle = (title: string): string => title.trim().toLowerCase()

function tabInfo(sheet: SpreadsheetSheet): TabInfo {
  const { sheetId, title, gridProperties } = sheet.properties
  return {
    sheetId,
    title,
    rowCount: gridProperties?.rowCount ?? 0,
    columnCount: gridProperties?.columnCount ?? 0,
  }
}

const failure = (reason: string, detail?: string): { ok: false; error: SheetsFailure } => ({
  ok: false,
  error: {
    category: 'invalid_sheet',
    httpStatus: null,
    reason,
    ...(detail === undefined ? {} : { detail }),
  },
})

/**
 * `batchUpdate` subrequests for one op, as in the design's WriteOp translation table.
 * `columnCount` is the current width of the op's tab, used to grow the columns for `setHeader`.
 */
export function translateOp(op: WriteOp, columnCount: number): object[] {
  const row = (sheetId: number, rowIndex: number, columnIndex: number, values: CellData[]) => ({
    updateCells: {
      start: { sheetId, rowIndex, columnIndex },
      rows: [{ values }],
      fields: 'userEnteredValue',
    },
  })
  const rows = (sheetId: number, rowIndex: number) => ({
    sheetId,
    dimension: 'ROWS',
    startIndex: rowIndex,
    endIndex: rowIndex + 1,
  })
  switch (op.type) {
    case 'addTab':
      return [
        {
          addSheet: {
            properties: {
              sheetId: op.sheetId,
              title: op.title,
              gridProperties: { rowCount: NEW_TAB_ROWS, columnCount: NEW_TAB_COLUMNS },
            },
          },
        },
        row(op.sheetId, 0, 0, op.headers.map(stringCell)),
      ]
    case 'setHeader': {
      const grow = op.growColumnsTo === undefined ? 0 : op.growColumnsTo - columnCount
      // A grid that is already wide enough needs no appendDimension (a length of 0 is invalid).
      const append =
        grow > 0
          ? [{ appendDimension: { sheetId: op.sheetId, dimension: 'COLUMNS', length: grow } }]
          : []
      return [...append, row(op.sheetId, 0, op.column, [stringCell(op.text)])]
    }
    case 'insertRow':
      return [
        op.appendAtEnd
          ? { appendDimension: { sheetId: op.sheetId, dimension: 'ROWS', length: 1 } }
          : { insertDimension: { range: rows(op.sheetId, op.rowIndex), inheritFromBefore: true } },
        row(op.sheetId, op.rowIndex, 0, op.cells.map(stringCell)),
      ]
    case 'deleteRow':
      return [{ deleteDimension: { range: rows(op.sheetId, op.rowIndex) } }]
  }
}

/**
 * Per-process directory of tab titles. A title maps to its TabInfo when known present. After a
 * `listTabs`, a title that is not listed is known absent (for example "Companies" before the
 * first Mark as applied). Before any listing, an unlisted title is unknown.
 */
class TabDirectory {
  readonly #byTitle = new Map<string, TabInfo>()
  #listed = false

  lookup(title: string): TabInfo | null | undefined {
    const tab = this.#byTitle.get(normalizeTitle(title))
    if (tab !== undefined) return tab
    return this.#listed ? null : undefined
  }

  replaceAll(tabs: readonly TabInfo[]): void {
    this.#byTitle.clear()
    for (const tab of tabs) this.remember(tab)
    this.#listed = true
  }

  remember(tab: TabInfo): void {
    this.#byTitle.set(normalizeTitle(tab.title), tab)
  }

  adjust(sheetId: number, change: (tab: TabInfo) => TabInfo): void {
    for (const tab of this.#byTitle.values()) {
      if (tab.sheetId === sheetId) this.remember(change(tab))
    }
  }
}

export interface SheetsRestGatewayOptions {
  spreadsheetId: string
  token: AccessTokenProvider
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  log?: Logger
}

/**
 * `SheetsGateway` over the Sheets REST API v4. Cell requests name only the applications tab and
 * the Companies tab, and writes only touch those two tabs (13.4, 13.8). A cold start without a
 * Companies tab falls back to `listTabs` and a second read (3.1, 3.14).
 */
export class SheetsRestGateway implements SheetsGateway {
  readonly #path: string
  readonly #deps: SheetsRequestDeps
  readonly #directory = new TabDirectory()
  /** Normalized title of the applications tab, set by the last successful cell read. */
  #applicationsKey: string | undefined

  constructor(opts: SheetsRestGatewayOptions) {
    this.#path = `spreadsheets/${encodeURIComponent(opts.spreadsheetId)}`
    this.#deps = {
      token: opts.token,
      fetch: opts.fetch ?? ((input, init) => globalThis.fetch(input, init)),
      sleep: opts.sleep ?? defaultSleep,
      log: opts.log ?? consoleLogger,
    }
  }

  readSnapshot(
    applicationsTab: string,
  ): Promise<
    Result<{ applications: Grid; companies: Grid | null; tabs: TabInfo[] }, SheetsFailure>
  > {
    return this.#guard('GET', 'get', async () => {
      const read = await this.#readCells(applicationsTab, true, SNAPSHOT_FIELDS)
      if (!read.ok) return read
      const { applications, companies, tabs } = read.value
      return {
        ok: true,
        value: {
          applications: toGrid(applications),
          companies: companies === null ? null : toGrid(companies),
          tabs,
        },
      }
    })
  }

  listTabs(): Promise<Result<TabInfo[], SheetsFailure>> {
    return this.#guard('GET', 'get', async () => {
      const res = await this.#get(new URLSearchParams({ fields: TABS_FIELDS }))
      if (!res.ok) return res
      const tabs = res.value.sheets.map(tabInfo)
      this.#directory.replaceAll(tabs)
      return { ok: true, value: tabs }
    })
  }

  readApplicationsFresh(
    applicationsTab: string,
  ): Promise<Result<FreshApplications, SheetsFailure>> {
    return this.#guard('GET', 'get', async () => {
      const read = await this.#readCells(applicationsTab, false, FRESH_FIELDS)
      if (!read.ok) return read
      return {
        ok: true,
        value: { tab: tabInfo(read.value.applications), grid: toGrid(read.value.applications) },
      }
    })
  }

  applyBatch(ops: readonly WriteOp[]): Promise<Result<void, SheetsFailure>> {
    return this.#guard('POST', 'batchUpdate', async () => {
      const requests: object[] = []
      for (const op of ops) {
        if (op.type === 'addTab') {
          requests.push(...translateOp(op, NEW_TAB_COLUMNS))
          continue
        }
        const tab = this.#writableTab(op.sheetId)
        if (tab === undefined) return failure('unknown_sheet', String(op.sheetId))
        requests.push(...translateOp(op, tab.columnCount))
      }
      const res = await sheetsRequest(
        { method: 'POST', path: `${this.#path}:batchUpdate`, body: { requests }, kind: 'write' },
        batchResponseSchema,
        this.#deps,
      )
      if (!res.ok) return res
      for (const op of ops) this.#afterWrite(op)
      return { ok: true, value: undefined }
    })
  }

  /** Deletes one row of the applications tab through `applyBatch`. */
  deleteRow(sheetId: number, rowIndex: number): Promise<Result<void, SheetsFailure>> {
    return this.applyBatch([{ type: 'deleteRow', sheetId, rowIndex }])
  }

  /** The applications tab or the Companies tab with this id; writes go nowhere else (13.8). */
  #writableTab(sheetId: number): TabInfo | undefined {
    const candidates = [
      this.#applicationsKey === undefined
        ? undefined
        : this.#directory.lookup(this.#applicationsKey),
      this.#directory.lookup(COMPANIES_TAB),
    ]
    return candidates.find((tab): tab is TabInfo => tab?.sheetId === sheetId)
  }

  #afterWrite(op: WriteOp): void {
    switch (op.type) {
      case 'addTab':
        this.#directory.remember({
          sheetId: op.sheetId,
          title: op.title,
          rowCount: NEW_TAB_ROWS,
          columnCount: NEW_TAB_COLUMNS,
        })
        return
      case 'setHeader': {
        const width = op.growColumnsTo
        if (width !== undefined) {
          this.#directory.adjust(op.sheetId, (tab) => ({
            ...tab,
            columnCount: Math.max(tab.columnCount, width),
          }))
        }
        return
      }
      case 'insertRow':
        this.#directory.adjust(op.sheetId, (tab) => ({ ...tab, rowCount: tab.rowCount + 1 }))
        return
      case 'deleteRow':
        this.#directory.adjust(op.sheetId, (tab) => ({ ...tab, rowCount: tab.rowCount - 1 }))
        return
    }
  }

  /**
   * One `spreadsheets.get` with grid data for the applications tab and, when asked, the
   * Companies tab. Titles come from the directory when known. A 400 "Unable to parse range"
   * (unknown or stale directory) leads to one `listTabs` and one repeated read.
   */
  async #readCells(
    applicationsTab: string,
    withCompanies: boolean,
    fields: string,
  ): Promise<
    Result<
      { applications: SpreadsheetSheet; companies: SpreadsheetSheet | null; tabs: TabInfo[] },
      SheetsFailure
    >
  > {
    for (let attempt = 0; ; attempt++) {
      const app = this.#directory.lookup(applicationsTab)
      if (app === null) return failure('missing_tab', applicationsTab)
      const ranges = [app?.title ?? applicationsTab]
      const companies = withCompanies ? this.#directory.lookup(COMPANIES_TAB) : null
      if (withCompanies && companies !== null) ranges.push(companies?.title ?? COMPANIES_TAB)

      const query = new URLSearchParams()
      for (const title of ranges) query.append('ranges', quoteSheetName(title))
      query.set('includeGridData', 'true')
      query.set('fields', fields)
      const res = await this.#get(query)
      if (!res.ok) {
        if (attempt === 0 && res.error.reason === RANGE_PARSE_REASON) {
          const listed = await this.listTabs()
          if (!listed.ok) return listed
          continue
        }
        return res
      }

      const sheets = res.value.sheets
      for (const sheet of sheets) this.#directory.remember(tabInfo(sheet))
      const find = (title: string) =>
        sheets.find((sheet) => normalizeTitle(sheet.properties.title) === normalizeTitle(title))
      const applications = find(applicationsTab)
      if (applications === undefined) {
        return {
          ok: false,
          error: { category: 'invalid_sheet', httpStatus: 200, reason: 'unexpected_response' },
        }
      }
      this.#applicationsKey = normalizeTitle(applications.properties.title)
      return {
        ok: true,
        value: {
          applications,
          companies: withCompanies ? (find(COMPANIES_TAB) ?? null) : null,
          tabs: sheets.map(tabInfo),
        },
      }
    }
  }

  #get(query: URLSearchParams) {
    return sheetsRequest(
      { method: 'GET', path: this.#path, query, kind: 'read' },
      spreadsheetSchema,
      this.#deps,
    )
  }

  /** Turns an unexpected exception into a `network` / `unexpected_error` failure. */
  async #guard<T>(
    method: 'GET' | 'POST',
    endpoint: SheetsEndpoint,
    run: () => Promise<Result<T, SheetsFailure>>,
  ): Promise<Result<T, SheetsFailure>> {
    try {
      return await run()
    } catch {
      const error: SheetsFailure = {
        category: 'network',
        httpStatus: null,
        reason: 'unexpected_error',
      }
      this.#deps.log({ ...error, method, endpoint })
      return { ok: false, error }
    }
  }
}

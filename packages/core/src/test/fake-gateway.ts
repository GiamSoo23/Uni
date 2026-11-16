import type { FreshApplications, SheetsGateway, TabInfo, WriteOp } from '../sheets/gateway'
import type { Grid, RawCell, Result, SheetsFailure } from '../sheets/types'

/** One tab of the fake Sheet. */
export interface FakeTab {
  sheetId: number
  title: string
  /** Grid size, as in `gridProperties`. `rows` never extends beyond it. */
  rowCount: number
  columnCount: number
  /** Displayed text; row 0 is sheet row 1. Rows may be ragged and shorter than the grid; missing cells are ''. */
  rows: string[][]
}

export interface FakeSheetState {
  tabs: FakeTab[]
}

export type GatewayMethod = 'readSnapshot' | 'listTabs' | 'readApplicationsFresh' | 'applyBatch'

/** One recorded gateway call. */
export interface GatewayCall {
  method: GatewayMethod
  kind: 'read' | 'write'
  /** Titles of the tabs whose cells the call reads or writes, resolved when the call is made. Empty for `listTabs`. */
  tabs: string[]
  /** The ops of an `applyBatch` call. */
  ops?: WriteOp[]
}

/** What an injected call does before (or instead of) touching the fake Sheet. */
export interface CallBehavior {
  /** Awaited before the call is processed, e.g. a promise from `fc.scheduler()`. */
  wait?: () => Promise<unknown>
  /** Returned instead of processing the call. The Sheet is left unchanged. */
  failure?: SheetsFailure
}

export interface FakeGatewayOptions {
  /** Consulted for every call that has no behavior queued with `inject`. */
  onCall?: (call: GatewayCall, index: number) => CallBehavior | undefined
}

/** Grid size of a tab created by `addTab`, as in the REST translation. */
export const NEW_TAB_ROWS = 1000
export const NEW_TAB_COLUMNS = 6

/**
 * In-memory `SheetsGateway` that models the Sheet the way the REST adapter drives it.
 *
 * - Reads resolve tab titles trimmed and case-insensitively, return formatted values only (no links),
 *   and drop trailing empty cells and rows, as `spreadsheets.get` does.
 * - `applyBatch` applies the ops in order to a copy and commits only when every op is valid, like an
 *   atomic `batchUpdate`. Values lose one leading apostrophe (`stringValue` display). `insertRow`
 *   uses `insertDimension` (inheriting from the row before, so `rowIndex` must be in 1..rowCount-1)
 *   or `appendDimension` plus `updateCells` at `rowIndex`. `setHeader` grows the columns first when
 *   asked. `addTab` creates a 1000 × 6 tab with the chosen id. An empty batch, cells written outside
 *   the grid, unknown or duplicate sheet ids, duplicate titles and deleting the last row are invalid.
 * - Every call is recorded, and failures and delays can be injected per call.
 */
export class InMemorySheetsGateway implements SheetsGateway {
  #state: FakeSheetState
  readonly #calls: GatewayCall[] = []
  readonly #queued = new Map<GatewayMethod, CallBehavior[]>()
  readonly #onCall: FakeGatewayOptions['onCall']

  constructor(state: FakeSheetState, options: FakeGatewayOptions = {}) {
    const problem = validateState(state)
    if (problem !== null) throw new Error(`Invalid fake sheet state: ${problem}`)
    this.#state = structuredClone(state)
    this.#onCall = options.onCall
  }

  /** Every call so far, in call order. */
  get calls(): readonly GatewayCall[] {
    return this.#calls
  }

  /** Number of recorded calls of the given kind. */
  count(kind: 'read' | 'write'): number {
    return this.#calls.filter((call) => call.kind === kind).length
  }

  /** A deep copy of the current Sheet. */
  state(): FakeSheetState {
    return structuredClone(this.#state)
  }

  /** A deep copy of the tab whose trimmed title matches case-insensitively, or undefined. */
  tab(title: string): FakeTab | undefined {
    const tab = findTab(this.#state, title)
    return tab === undefined ? undefined : structuredClone(tab)
  }

  /** Queues a behavior for the next call of `method`. Queued behaviors are used first-in, first-out. */
  inject(method: GatewayMethod, behavior: CallBehavior): void {
    const queue = this.#queued.get(method) ?? []
    queue.push(behavior)
    this.#queued.set(method, queue)
  }

  readSnapshot(
    applicationsTab: string,
  ): Promise<
    Result<{ applications: Grid; companies: Grid | null; tabs: TabInfo[] }, SheetsFailure>
  > {
    const tabs = [findTab(this.#state, applicationsTab), findTab(this.#state, 'Companies')]
    const titles = tabs.flatMap((tab) => (tab === undefined ? [] : [tab.title]))
    return this.#run({ method: 'readSnapshot', kind: 'read', tabs: titles }, () => {
      const apps = findTab(this.#state, applicationsTab)
      if (apps === undefined) return missingTab(applicationsTab)
      const companies = findTab(this.#state, 'Companies')
      return {
        ok: true,
        value: {
          applications: toGrid(apps),
          companies: companies === undefined ? null : toGrid(companies),
          tabs: this.#state.tabs.map(toTabInfo),
        },
      }
    })
  }

  listTabs(): Promise<Result<TabInfo[], SheetsFailure>> {
    return this.#run({ method: 'listTabs', kind: 'read', tabs: [] }, () => ({
      ok: true,
      value: this.#state.tabs.map(toTabInfo),
    }))
  }

  readApplicationsFresh(
    applicationsTab: string,
  ): Promise<Result<FreshApplications, SheetsFailure>> {
    const found = findTab(this.#state, applicationsTab)
    const titles = found === undefined ? [] : [found.title]
    return this.#run({ method: 'readApplicationsFresh', kind: 'read', tabs: titles }, () => {
      const apps = findTab(this.#state, applicationsTab)
      if (apps === undefined) return missingTab(applicationsTab)
      return { ok: true, value: { tab: toTabInfo(apps), grid: toGrid(apps) } }
    })
  }

  applyBatch(ops: readonly WriteOp[]): Promise<Result<void, SheetsFailure>> {
    const copy = structuredClone([...ops])
    const titles = [...new Set(copy.map((op) => this.#titleOf(op)))]
    return this.#run({ method: 'applyBatch', kind: 'write', tabs: titles, ops: copy }, () => {
      const next = structuredClone(this.#state)
      const problem =
        copy.length === 0
          ? 'batchUpdate needs at least one request'
          : copy.reduce<string | null>((found, op) => found ?? applyOp(next, op), null)
      if (problem !== null) {
        return {
          ok: false,
          error: {
            category: 'invalid_sheet',
            httpStatus: 400,
            reason: 'INVALID_ARGUMENT',
            detail: problem,
          },
        }
      }
      this.#state = next
      return { ok: true, value: undefined }
    })
  }

  #titleOf(op: WriteOp): string {
    if (op.type === 'addTab') return op.title
    return this.#state.tabs.find((tab) => tab.sheetId === op.sheetId)?.title ?? `#${op.sheetId}`
  }

  async #run<T>(
    call: GatewayCall,
    process: () => Result<T, SheetsFailure>,
  ): Promise<Result<T, SheetsFailure>> {
    const index = this.#calls.length
    this.#calls.push(call)
    const behavior = this.#queued.get(call.method)?.shift() ?? this.#onCall?.(call, index)
    if (behavior?.wait !== undefined) await behavior.wait()
    if (behavior?.failure !== undefined) return { ok: false, error: { ...behavior.failure } }
    return process()
  }
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase()
}

function findTab(state: FakeSheetState, title: string): FakeTab | undefined {
  const key = normalizeTitle(title)
  return state.tabs.find((tab) => normalizeTitle(tab.title) === key)
}

function missingTab(title: string): Result<never, SheetsFailure> {
  return {
    ok: false,
    error: { category: 'invalid_sheet', httpStatus: null, reason: 'missing_tab', detail: title },
  }
}

function toTabInfo(tab: FakeTab): TabInfo {
  return {
    sheetId: tab.sheetId,
    title: tab.title,
    rowCount: tab.rowCount,
    columnCount: tab.columnCount,
  }
}

/** Formatted values as `spreadsheets.get` returns them: no trailing empty cells or rows. */
function toGrid(tab: FakeTab): Grid {
  const rows = tab.rows.map((values) => {
    let end = values.length
    while (end > 0 && values[end - 1] === '') end -= 1
    return values.slice(0, end).map((text): RawCell => ({ text, hyperlink: null, runLinks: [] }))
  })
  while (rows.length > 0 && rows[rows.length - 1]?.length === 0) rows.pop()
  return rows
}

function validateState(state: FakeSheetState): string | null {
  const ids = new Set<number>()
  const titles = new Set<string>()
  for (const tab of state.tabs) {
    if (!isIndex(tab.sheetId)) return `sheetId ${tab.sheetId} is not a non-negative integer`
    if (ids.has(tab.sheetId)) return `duplicate sheetId ${tab.sheetId}`
    if (titles.has(tab.title.toLowerCase())) return `duplicate title "${tab.title}"`
    ids.add(tab.sheetId)
    titles.add(tab.title.toLowerCase())
    if (!isIndex(tab.rowCount) || tab.rowCount < 1) return `"${tab.title}" has no rows`
    if (!isIndex(tab.columnCount) || tab.columnCount < 1) return `"${tab.title}" has no columns`
    if (tab.rows.length > tab.rowCount) return `"${tab.title}" has rows beyond rowCount`
    if (tab.rows.some((values) => values.length > tab.columnCount)) {
      return `"${tab.title}" has cells beyond columnCount`
    }
  }
  return null
}

function isIndex(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

/** Removes the leading apostrophe added by `escapeCell`, as a `stringValue` write displays it. */
function displayed(value: string): string {
  return value.startsWith("'") ? value.slice(1) : value
}

function setCell(tab: FakeTab, rowIndex: number, column: number, value: string): void {
  while (tab.rows.length <= rowIndex) tab.rows.push([])
  const values = tab.rows[rowIndex] ?? []
  while (values.length <= column) values.push('')
  values[column] = value
  tab.rows[rowIndex] = values
}

/** Applies one op to `state` in place. Returns why the op is invalid, or null. */
function applyOp(state: FakeSheetState, op: WriteOp): string | null {
  if (op.type === 'addTab') {
    if (!isIndex(op.sheetId)) return `addTab: invalid sheetId ${op.sheetId}`
    if (state.tabs.some((tab) => tab.sheetId === op.sheetId)) {
      return `addTab: a sheet with id ${op.sheetId} already exists`
    }
    if (state.tabs.some((tab) => tab.title.toLowerCase() === op.title.toLowerCase())) {
      return `addTab: a sheet named "${op.title}" already exists`
    }
    if (op.headers.length > NEW_TAB_COLUMNS) return 'addTab: headers exceed the new grid'
    state.tabs.push({
      sheetId: op.sheetId,
      title: op.title,
      rowCount: NEW_TAB_ROWS,
      columnCount: NEW_TAB_COLUMNS,
      rows: [op.headers.map(displayed)],
    })
    return null
  }

  const tab = state.tabs.find((candidate) => candidate.sheetId === op.sheetId)
  if (tab === undefined) return `${op.type}: no sheet with id ${op.sheetId}`

  switch (op.type) {
    case 'setHeader': {
      if (op.growColumnsTo !== undefined) {
        if (!isIndex(op.growColumnsTo) || op.growColumnsTo <= tab.columnCount) {
          return `setHeader: cannot grow ${tab.columnCount} columns to ${op.growColumnsTo}`
        }
        tab.columnCount = op.growColumnsTo
      }
      if (!isIndex(op.column) || op.column >= tab.columnCount) {
        return `setHeader: column ${op.column} is outside the grid`
      }
      setCell(tab, 0, op.column, displayed(op.text))
      return null
    }
    case 'insertRow': {
      if (!isIndex(op.rowIndex)) return `insertRow: invalid rowIndex ${op.rowIndex}`
      if (op.appendAtEnd) {
        tab.rowCount += 1
      } else {
        if (op.rowIndex < 1 || op.rowIndex >= tab.rowCount) {
          return `insertRow: cannot insert at ${op.rowIndex} in ${tab.rowCount} rows`
        }
        while (tab.rows.length < op.rowIndex) tab.rows.push([])
        tab.rows.splice(op.rowIndex, 0, [])
        tab.rowCount += 1
      }
      if (op.rowIndex >= tab.rowCount) return `insertRow: row ${op.rowIndex} is outside the grid`
      if (op.cells.length > tab.columnCount) return 'insertRow: cells exceed the grid'
      op.cells.forEach((value, column) => {
        setCell(tab, op.rowIndex, column, displayed(value))
      })
      return null
    }
    case 'deleteRow': {
      if (!isIndex(op.rowIndex) || op.rowIndex >= tab.rowCount) {
        return `deleteRow: row ${op.rowIndex} is outside the grid`
      }
      if (tab.rowCount === 1) return 'deleteRow: cannot delete every row'
      if (op.rowIndex < tab.rows.length) tab.rows.splice(op.rowIndex, 1)
      tab.rowCount -= 1
      return null
    }
  }
}

import type { TabInfo, WriteOp } from './gateway'
import { buildHeaderMap, normalizeHeader, type HeaderMap } from './header'
import { COMPANIES_COLUMNS } from './overrides'

const JOB_ID_HEADER = 'Job ID'
const COMPANIES_TAB = 'Companies'

/**
 * Plans the Sheet_Setup writes of a Mark as applied (Requirement 5). Without a "Job ID" header,
 * it writes one right of the rightmost non-empty header (5.1), growing the grid when that column
 * is outside it. Without a "Companies" tab, it adds one with the six Companies headers (5.2). Both
 * checks are trimmed and case-insensitive, and when both exist there are no ops (5.3). The ops
 * only add cells and tabs, so existing headers, rows and tabs stay unchanged (5.4).
 *
 * Returns the ops and the Header_Map the new row is serialized with, which includes Job ID.
 */
export function planSetup(
  tabs: readonly TabInfo[],
  header: HeaderMap,
  appTab: TabInfo,
  newSheetId: number,
): { ops: WriteOp[]; header: HeaderMap } {
  const ops: WriteOp[] = []
  let result = header

  if (!header.index.has(normalizeHeader(JOB_ID_HEADER))) {
    const column = header.headers.length
    ops.push({
      type: 'setHeader',
      sheetId: appTab.sheetId,
      column,
      text: JOB_ID_HEADER,
      ...(column >= appTab.columnCount ? { growColumnsTo: column + 1 } : {}),
    })
    result = buildHeaderMap([...header.headers, JOB_ID_HEADER])
  }

  const companiesKey = normalizeHeader(COMPANIES_TAB)
  if (!tabs.some((tab) => normalizeHeader(tab.title) === companiesKey)) {
    ops.push({
      type: 'addTab',
      title: COMPANIES_TAB,
      sheetId: newSheetId,
      headers: COMPANIES_COLUMNS,
    })
  }

  return { ops, header: result }
}

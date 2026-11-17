import { describe, expect, it, vi } from 'vitest'
import type { SheetsLogEntry } from '@/lib/sheets/http'
import {
  FRESH_FIELDS,
  quoteSheetName,
  SheetsRestGateway,
  SNAPSHOT_FIELDS,
  stringCell,
  TABS_FIELDS,
} from '@/lib/sheets/rest-gateway'
import type { AccessTokenProvider } from '@/lib/sheets/token'

// Google is never called: `fetch` and the token provider are injected.
const SHEET = 'sheet-123'
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const rangeError = () =>
  json(400, {
    error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Unable to parse range: Companies' },
  })
const props = (sheetId: number, title: string, rowCount = 1000, columnCount = 26) => ({
  sheetId,
  title,
  gridProperties: { rowCount, columnCount },
})
const cells = (...rows: string[][]) => [
  { rowData: rows.map((row) => ({ values: row.map((formattedValue) => ({ formattedValue })) })) },
]
const TRACKER = {
  properties: props(7, 'Tracker'),
  data: cells(['Company', 'Role'], ['Acme', 'SWE']),
}
const COMPANIES = { properties: props(9, 'Companies', 1000, 6), data: cells(['Company']) }
const ALL_TABS = {
  sheets: [{ properties: props(7, 'Tracker') }, { properties: props(3, 'SHPE 2026') }],
}

function setup(responses: (() => Response)[], token?: AccessTokenProvider) {
  const fetchMock = vi.fn<typeof fetch>(() => {
    const next = responses.shift()
    return Promise.resolve(next ? next() : json(500, {}))
  })
  const logs: SheetsLogEntry[] = []
  const gateway = new SheetsRestGateway({
    spreadsheetId: SHEET,
    token: token ?? { getToken: () => Promise.resolve({ ok: true, value: 'test-token' }) },
    fetch: fetchMock,
    sleep: () => Promise.resolve(),
    log: (entry) => logs.push(entry),
  })
  const url = (call: number) => new URL(String(fetchMock.mock.calls[call]![0]))
  const body = (call: number): unknown => JSON.parse(String(fetchMock.mock.calls[call]![1]!.body))
  return { gateway, fetchMock, logs, url, body }
}

describe('stringCell and quoteSheetName', () => {
  it('strips one escape apostrophe and leaves empty values empty', () => {
    expect(stringCell("'=1+1")).toEqual({ userEnteredValue: { stringValue: '=1+1' } })
    expect(stringCell("''x")).toEqual({ userEnteredValue: { stringValue: "'x" } })
    expect(stringCell('Acme')).toEqual({ userEnteredValue: { stringValue: 'Acme' } })
    expect(stringCell('')).toEqual({})
  })

  it('quotes tab names and doubles inner quotes', () => {
    expect(quoteSheetName('Tracker')).toBe("'Tracker'")
    expect(quoteSheetName("Bob's tab")).toBe("'Bob''s tab'")
  })
})

describe('SheetsRestGateway reads', () => {
  it('reads both tabs with links in one request when Companies exists', async () => {
    const { gateway, fetchMock, url } = setup([() => json(200, { sheets: [TRACKER, COMPANIES] })])
    const result = await gateway.readSnapshot('Tracker')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(url(0).pathname).toBe(`/v4/spreadsheets/${SHEET}`)
    expect(url(0).searchParams.getAll('ranges')).toEqual(["'Tracker'", "'Companies'"])
    expect(url(0).searchParams.get('includeGridData')).toBe('true')
    expect(url(0).searchParams.get('fields')).toBe(SNAPSHOT_FIELDS)
    expect(result.ok && result.value.applications[1]?.[0]?.text).toBe('Acme')
    expect(result.ok && result.value.companies?.[0]?.[0]?.text).toBe('Company')
  })

  it('falls back to listTabs and a second read when Companies is missing', async () => {
    const { gateway, fetchMock, url } = setup([
      rangeError,
      () => json(200, ALL_TABS),
      () => json(200, { sheets: [TRACKER] }),
      () => json(200, { sheets: [TRACKER] }),
    ])
    const result = await gateway.readSnapshot('Tracker')
    expect(result.ok && result.value.companies).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(url(1).searchParams.get('fields')).toBe(TABS_FIELDS)
    expect(url(1).searchParams.has('ranges')).toBe(false)
    expect(url(2).searchParams.getAll('ranges')).toEqual(["'Tracker'"])

    // The directory now knows Companies is absent: one request per read.
    await gateway.readSnapshot('Tracker')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(url(3).searchParams.getAll('ranges')).toEqual(["'Tracker'"])
  })

  it('fails with invalid_sheet naming the configured tab when it does not exist', async () => {
    const { gateway, fetchMock } = setup([
      rangeError,
      () => json(200, { sheets: [{ properties: props(3, 'SHPE 2026') }] }),
    ])
    expect(await gateway.readSnapshot('Tracker')).toEqual({
      ok: false,
      error: {
        category: 'invalid_sheet',
        httpStatus: null,
        reason: 'missing_tab',
        detail: 'Tracker',
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reads the applications tab fresh with the formatted-values mask', async () => {
    const { gateway, url } = setup([() => json(200, { sheets: [TRACKER] })])
    const result = await gateway.readApplicationsFresh('Tracker')
    expect(url(0).searchParams.getAll('ranges')).toEqual(["'Tracker'"])
    expect(url(0).searchParams.get('fields')).toBe(FRESH_FIELDS)
    expect(result.ok && result.value.tab).toEqual({
      sheetId: 7,
      title: 'Tracker',
      rowCount: 1000,
      columnCount: 26,
    })
  })

  it('turns an unexpected exception into network / unexpected_error', async () => {
    const { gateway, logs } = setup([], { getToken: () => Promise.reject(new Error('boom')) })
    expect(await gateway.listTabs()).toEqual({
      ok: false,
      error: { category: 'network', httpStatus: null, reason: 'unexpected_error' },
    })
    expect(logs).toEqual([
      {
        category: 'network',
        httpStatus: null,
        reason: 'unexpected_error',
        method: 'GET',
        endpoint: 'get',
      },
    ])
  })
})

describe('SheetsRestGateway writes', () => {
  it('translates an inserted row and strips the escape apostrophe', async () => {
    const { gateway, url, body } = setup([
      () => json(200, { sheets: [TRACKER] }),
      () => json(200, { replies: [] }),
    ])
    await gateway.readApplicationsFresh('Tracker')
    const result = await gateway.applyBatch([
      {
        type: 'insertRow',
        sheetId: 7,
        rowIndex: 2,
        cells: ["'=1+1", '', 'SWE'],
        appendAtEnd: false,
      },
    ])
    expect(result).toEqual({ ok: true, value: undefined })
    expect(url(1).pathname).toBe(`/v4/spreadsheets/${SHEET}:batchUpdate`)
    expect(body(1)).toEqual({
      requests: [
        {
          insertDimension: {
            range: { sheetId: 7, dimension: 'ROWS', startIndex: 2, endIndex: 3 },
            inheritFromBefore: true,
          },
        },
        {
          updateCells: {
            start: { sheetId: 7, rowIndex: 2, columnIndex: 0 },
            rows: [
              {
                values: [
                  { userEnteredValue: { stringValue: '=1+1' } },
                  {},
                  { userEnteredValue: { stringValue: 'SWE' } },
                ],
              },
            ],
            fields: 'userEnteredValue',
          },
        },
      ],
    })
  })

  it('names Companies in later reads after addTab creates it', async () => {
    const { gateway, url } = setup([
      rangeError,
      () => json(200, ALL_TABS),
      () => json(200, { sheets: [TRACKER] }),
      () => json(200, { replies: [] }),
      () => json(200, { sheets: [TRACKER, COMPANIES] }),
    ])
    await gateway.readSnapshot('Tracker')
    const added = await gateway.applyBatch([
      { type: 'addTab', title: 'Companies', sheetId: 9, headers: ['Company'] },
    ])
    expect(added.ok).toBe(true)
    await gateway.readSnapshot('Tracker')
    expect(url(4).searchParams.getAll('ranges')).toEqual(["'Tracker'", "'Companies'"])
  })

  it('sends nothing for an op on a tab other than the applications tab or Companies', async () => {
    const { gateway, fetchMock } = setup([
      () => json(200, ALL_TABS),
      () => json(200, { sheets: [TRACKER] }),
    ])
    await gateway.listTabs()
    await gateway.readApplicationsFresh('Tracker')
    const result = await gateway.applyBatch([{ type: 'deleteRow', sheetId: 3, rowIndex: 1 }])
    expect(result).toEqual({
      ok: false,
      error: { category: 'invalid_sheet', httpStatus: null, reason: 'unknown_sheet', detail: '3' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

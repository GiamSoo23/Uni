import { describe, expect, it } from 'vitest'
import type { SheetsFailure } from '../sheets/types'
import { type FakeSheetState, InMemorySheetsGateway, NEW_TAB_ROWS } from './fake-gateway'

const TRACKER = 10
const SUMMARY = 20

function sheet(): FakeSheetState {
  return {
    tabs: [
      {
        sheetId: TRACKER,
        title: 'Tracker',
        rowCount: 5,
        columnCount: 3,
        rows: [['Company', 'Role', ''], ['Acme', 'SWE', ''], [], ['', '', 'spill'], ['', '']],
      },
      { sheetId: SUMMARY, title: 'Summary', rowCount: 2, columnCount: 2, rows: [['Total', '1']] },
    ],
  }
}

function texts(grid: readonly (readonly { text: string }[])[]): string[][] {
  return grid.map((values) => values.map((value) => value.text))
}

const RATE_LIMITED: SheetsFailure = {
  category: 'rate_limited',
  httpStatus: 429,
  reason: 'RESOURCE_EXHAUSTED',
}

describe('InMemorySheetsGateway reads', () => {
  it('reads the applications tab by trimmed, case-insensitive title without trailing empties', async () => {
    const gateway = new InMemorySheetsGateway(sheet())
    const result = await gateway.readApplicationsFresh(' tracker ')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.tab).toEqual({
      sheetId: TRACKER,
      title: 'Tracker',
      rowCount: 5,
      columnCount: 3,
    })
    expect(texts(result.value.grid)).toEqual([
      ['Company', 'Role'],
      ['Acme', 'SWE'],
      [],
      ['', '', 'spill'],
    ])
    expect(result.value.grid[1]?.[0]).toEqual({ text: 'Acme', hyperlink: null, runLinks: [] })
    expect(gateway.calls).toEqual([
      { method: 'readApplicationsFresh', kind: 'read', tabs: ['Tracker'] },
    ])
  })

  it('reads the snapshot with Companies null when absent and names only the tabs it reads', async () => {
    const gateway = new InMemorySheetsGateway(sheet())
    const result = await gateway.readSnapshot('Tracker')
    expect(result.ok && result.value.companies).toBeNull()
    expect(result.ok && result.value.tabs.map((tab) => tab.title)).toEqual(['Tracker', 'Summary'])
    expect(gateway.calls[0]?.tabs).toEqual(['Tracker'])

    const withCompanies = sheet()
    withCompanies.tabs.push({
      sheetId: 30,
      title: ' companies',
      rowCount: 3,
      columnCount: 6,
      rows: [['Company', 'Policy']],
    })
    const second = new InMemorySheetsGateway(withCompanies)
    const snapshot = await second.readSnapshot('Tracker')
    expect(snapshot.ok && snapshot.value.companies && texts(snapshot.value.companies)).toEqual([
      ['Company', 'Policy'],
    ])
    expect(second.calls[0]?.tabs).toEqual(['Tracker', ' companies'])
  })

  it('fails a read of a missing applications tab with invalid_sheet naming the tab', async () => {
    const gateway = new InMemorySheetsGateway(sheet())
    const expected = { category: 'invalid_sheet', reason: 'missing_tab', detail: 'Applications' }
    expect(await gateway.readSnapshot('Applications')).toMatchObject({ ok: false, error: expected })
    expect(await gateway.readApplicationsFresh('Applications')).toMatchObject({
      ok: false,
      error: expected,
    })
    expect(gateway.calls.map((call) => call.tabs)).toEqual([[], []])
  })

  it('lists tab metadata without naming any tab', async () => {
    const gateway = new InMemorySheetsGateway(sheet())
    const result = await gateway.listTabs()
    expect(result.ok && result.value).toEqual([
      { sheetId: TRACKER, title: 'Tracker', rowCount: 5, columnCount: 3 },
      { sheetId: SUMMARY, title: 'Summary', rowCount: 2, columnCount: 2 },
    ])
    expect(gateway.calls).toEqual([{ method: 'listTabs', kind: 'read', tabs: [] }])
  })
})

describe('InMemorySheetsGateway writes', () => {
  it('applies setup and an inserted row in one batch, stripping the apostrophe', async () => {
    const gateway = new InMemorySheetsGateway(sheet())
    const result = await gateway.applyBatch([
      { type: 'setHeader', sheetId: TRACKER, column: 3, text: 'Job ID', growColumnsTo: 4 },
      { type: 'addTab', title: 'Companies', sheetId: 99, headers: ['Company', 'Policy'] },
      {
        type: 'insertRow',
        sheetId: TRACKER,
        rowIndex: 4,
        cells: ['Globex', "'=SUM(A1)", '', 'simplify:1'],
        appendAtEnd: false,
      },
    ])
    expect(result).toEqual({ ok: true, value: undefined })
    const tracker = gateway.tab('Tracker')
    expect(tracker?.columnCount).toBe(4)
    expect(tracker?.rowCount).toBe(6)
    expect(tracker?.rows).toEqual([
      ['Company', 'Role', '', 'Job ID'],
      ['Acme', 'SWE', ''],
      [],
      ['', '', 'spill'],
      ['Globex', '=SUM(A1)', '', 'simplify:1'],
      ['', ''],
    ])
    expect(gateway.tab('Companies')).toEqual({
      sheetId: 99,
      title: 'Companies',
      rowCount: NEW_TAB_ROWS,
      columnCount: 6,
      rows: [['Company', 'Policy']],
    })
    expect(gateway.calls).toHaveLength(1)
    expect(gateway.calls[0]).toMatchObject({ kind: 'write', tabs: ['Tracker', 'Companies'] })
    expect(gateway.count('write')).toBe(1)
  })

  it('appends a row at the end of a full grid', async () => {
    const gateway = new InMemorySheetsGateway(sheet())
    const result = await gateway.applyBatch([
      { type: 'insertRow', sheetId: TRACKER, rowIndex: 5, cells: ['Initech'], appendAtEnd: true },
    ])
    expect(result.ok).toBe(true)
    expect(gateway.tab('Tracker')?.rowCount).toBe(6)
    expect(gateway.tab('Tracker')?.rows[5]).toEqual(['Initech'])
  })

  it('deletes a row and shifts the rows below it up', async () => {
    const gateway = new InMemorySheetsGateway(sheet())
    expect(
      (await gateway.applyBatch([{ type: 'deleteRow', sheetId: TRACKER, rowIndex: 1 }])).ok,
    ).toBe(true)
    expect(gateway.tab('Tracker')?.rowCount).toBe(4)
    expect(gateway.tab('Tracker')?.rows).toEqual([
      ['Company', 'Role', ''],
      [],
      ['', '', 'spill'],
      ['', ''],
    ])
  })

  it('rejects a whole batch when one op is invalid', async () => {
    const cases = [
      [
        { type: 'setHeader', sheetId: TRACKER, column: 3, text: 'Job ID', growColumnsTo: 4 },
        { type: 'addTab', title: 'Companies', sheetId: SUMMARY, headers: ['Company'] },
      ],
      [{ type: 'setHeader', sheetId: TRACKER, column: 3, text: 'Job ID' }],
      [
        {
          type: 'insertRow',
          sheetId: TRACKER,
          rowIndex: 2,
          cells: ['a', 'b', 'c', 'd'],
          appendAtEnd: false,
        },
      ],
      [{ type: 'insertRow', sheetId: TRACKER, rowIndex: 0, cells: ['a'], appendAtEnd: false }],
      [{ type: 'insertRow', sheetId: TRACKER, rowIndex: 7, cells: ['a'], appendAtEnd: true }],
      [{ type: 'deleteRow', sheetId: 404, rowIndex: 1 }],
      [{ type: 'deleteRow', sheetId: TRACKER, rowIndex: 5 }],
      [
        {
          type: 'addTab',
          title: 'Companies',
          sheetId: 99,
          headers: ['1', '2', '3', '4', '5', '6', '7'],
        },
      ],
      [],
    ] as const
    for (const ops of cases) {
      const gateway = new InMemorySheetsGateway(sheet())
      const result = await gateway.applyBatch(ops)
      expect(result).toMatchObject({
        ok: false,
        error: { category: 'invalid_sheet', httpStatus: 400, reason: 'INVALID_ARGUMENT' },
      })
      expect(gateway.state()).toEqual(sheet())
    }
  })

  it('rejects adding a tab whose title already exists, ignoring case', async () => {
    const state = sheet()
    state.tabs.push({ sheetId: 30, title: 'COMPANIES', rowCount: 1, columnCount: 1, rows: [] })
    const gateway = new InMemorySheetsGateway(state)
    const result = await gateway.applyBatch([
      { type: 'addTab', title: 'Companies', sheetId: 31, headers: [] },
    ])
    expect(result.ok).toBe(false)
    expect(gateway.state()).toEqual(state)
  })
})

describe('InMemorySheetsGateway injection and state', () => {
  it('returns an injected failure without changing the Sheet', async () => {
    const gateway = new InMemorySheetsGateway(sheet())
    gateway.inject('applyBatch', { failure: RATE_LIMITED })
    const ops = [{ type: 'deleteRow', sheetId: TRACKER, rowIndex: 1 }] as const
    expect(await gateway.applyBatch(ops)).toEqual({ ok: false, error: RATE_LIMITED })
    expect(gateway.state()).toEqual(sheet())
    expect((await gateway.applyBatch(ops)).ok).toBe(true)
    expect(gateway.count('write')).toBe(2)
  })

  it('processes a delayed call when its wait resolves, after calls made later', async () => {
    let release = (): void => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const gateway = new InMemorySheetsGateway(sheet(), {
      onCall: (call, index) =>
        call.method === 'readApplicationsFresh' && index === 0 ? { wait: () => gate } : undefined,
    })
    const read = gateway.readApplicationsFresh('Tracker')
    expect(
      await gateway.applyBatch([{ type: 'deleteRow', sheetId: TRACKER, rowIndex: 1 }]),
    ).toEqual({
      ok: true,
      value: undefined,
    })
    release()
    const result = await read
    expect(result.ok && result.value.tab.rowCount).toBe(4)
    expect(gateway.calls.map((call) => call.kind)).toEqual(['read', 'write'])
  })

  it('rejects an invalid initial state and hands out copies', () => {
    const duplicate = sheet()
    duplicate.tabs.push({ sheetId: TRACKER, title: 'Other', rowCount: 1, columnCount: 1, rows: [] })
    expect(() => new InMemorySheetsGateway(duplicate)).toThrow(/duplicate sheetId/)
    const tooWide = sheet()
    tooWide.tabs[1]?.rows.push(['a', 'b', 'c'])
    expect(() => new InMemorySheetsGateway(tooWide)).toThrow(/beyond columnCount/)

    const input = sheet()
    const gateway = new InMemorySheetsGateway(input)
    input.tabs[0]?.rows.push(['changed'])
    gateway.state().tabs[0]?.rows.push(['changed'])
    expect(gateway.state()).toEqual(sheet())
  })
})

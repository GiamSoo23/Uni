import { describe, expect, it } from 'vitest'
import { TRACKER_HEADER, row } from '../test/sheets-fixtures'
import { buildHeaderMap } from './header'
import { parseApplicationRow } from './row-parser'
import { MAX_CELL_LENGTH, escapeCell, serializeApplicationRow } from './row-serializer'
import type { ApplicationRow } from './types'

const FULL_MAP = buildHeaderMap([...TRACKER_HEADER, 'Job ID'])

const ROW: ApplicationRow = {
  rowNumber: 7,
  company: 'Acme',
  role: 'SWE Intern',
  linkText: 'https://jobs.example/1',
  linkUrl: 'https://jobs.example/1',
  dateApplied: 'Nov 12, 2026',
  status: 'Submitted',
  appNumber: '',
  location: 'New York, NY; Remote',
  industry: 'Fintech',
  resumeVersion: 'v3',
  responseDate: '',
  nextStep: '-',
  nextStepDate: '',
  notes: '=Greenhouse. Found on the Simplify Summer 2027 GitHub list.',
  jobId: 'simplify:abc-123',
}

/** The Sheet display model: a value written with an escape apostrophe displays without it. */
function display(value: string): string {
  return value.startsWith("'") ? value.slice(1) : value
}

function serialize(source: ApplicationRow, headers: readonly string[]): string[] {
  const result = serializeApplicationRow(source, buildHeaderMap(headers))
  if (!result.ok) throw new Error(`unexpected error for ${result.error.column}`)
  return result.value
}

describe('escapeCell', () => {
  it('prefixes an apostrophe to formula-like values only', () => {
    for (const prefix of ['=', '+', '-', '@', "'"]) {
      expect(escapeCell(`${prefix}1`)).toBe(`'${prefix}1`)
    }
    expect(escapeCell('Acme')).toBe('Acme')
    expect(escapeCell('')).toBe('')
    expect(escapeCell('a=b')).toBe('a=b')
  })
})

describe('serializeApplicationRow', () => {
  it('writes one escaped value per column in Header_Map order', () => {
    expect(serialize(ROW, [...TRACKER_HEADER, 'Job ID'])).toEqual([
      'Acme',
      'SWE Intern',
      'https://jobs.example/1',
      'Nov 12, 2026',
      'Submitted',
      '',
      'New York, NY; Remote',
      'Fintech',
      'v3',
      '',
      "'-",
      '',
      "'=Greenhouse. Found on the Simplify Summer 2027 GitHub list.",
      'simplify:abc-123',
    ])
  })

  it('writes empty strings for unknown, empty and duplicate columns and a null Job ID', () => {
    const headers = [' role ', 'Extra', '', 'ROLE', 'Company', 'Job ID']
    expect(serialize({ ...ROW, jobId: null }, headers)).toEqual([
      'SWE Intern',
      '',
      '',
      '',
      'Acme',
      '',
    ])
  })

  it('writes the link text when the link URL is null', () => {
    const cells = serialize({ ...ROW, linkUrl: null, linkText: 'LinkedIn' }, ['Link'])
    expect(cells).toEqual(['LinkedIn'])
  })

  it('reads back through parseApplicationRow unchanged apart from the row number', () => {
    const cells = serialize(ROW, FULL_MAP.headers).map(display)
    expect(parseApplicationRow(row(...cells), FULL_MAP, 2)).toEqual({ ...ROW, rowNumber: 2 })
  })

  it('accepts values up to the limit and rejects longer escaped values with the column name', () => {
    const atLimit = 'a'.repeat(MAX_CELL_LENGTH)
    expect(serializeApplicationRow({ ...ROW, notes: atLimit }, FULL_MAP).ok).toBe(true)
    const escapedOver = `=${'a'.repeat(MAX_CELL_LENGTH - 1)}`
    expect(serializeApplicationRow({ ...ROW, notes: escapedOver }, FULL_MAP)).toEqual({
      ok: false,
      error: { column: 'Notes' },
    })
  })
})

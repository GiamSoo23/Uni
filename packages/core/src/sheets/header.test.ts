import { describe, expect, it } from 'vitest'
import { TRACKER_HEADER } from '../test/sheets-fixtures'
import {
  APPLICATION_COLUMNS,
  REQUIRED_APPLICATION_HEADERS,
  buildHeaderMap,
  missingColumns,
} from './header'

describe('buildHeaderMap', () => {
  it('maps the real Tracker header to 0-based columns', () => {
    const map = buildHeaderMap(TRACKER_HEADER)
    expect(map.index.get('company')).toBe(0)
    expect(map.index.get('notes')).toBe(12)
    expect(map.index.has('job id')).toBe(false)
    expect(map.headers).toEqual([...TRACKER_HEADER])
  })

  it('trims names and ignores case', () => {
    const map = buildHeaderMap(['  COMPANY ', 'role', ' Job id'])
    expect(map.index.get('company')).toBe(0)
    expect(map.index.get('role')).toBe(1)
    expect(map.index.get('job id')).toBe(2)
    expect(map.headers).toEqual(['COMPANY', 'role', 'Job id'])
  })

  it('keeps the leftmost of duplicate names', () => {
    const map = buildHeaderMap(['Notes', 'Company', ' notes '])
    expect(map.index.get('notes')).toBe(0)
  })

  it('ignores empty cells and stops headers at the rightmost non-empty cell', () => {
    const map = buildHeaderMap(['Company', '  ', '', 'Role', '', '   '])
    expect([...map.index.keys()]).toEqual(['company', 'role'])
    expect(map.index.has('')).toBe(false)
    expect(map.headers).toEqual(['Company', '', '', 'Role'])
  })

  it('gives an empty map for an empty or blank header row', () => {
    expect(buildHeaderMap([]).headers).toEqual([])
    const blank = buildHeaderMap(['', ' '])
    expect(blank.headers).toEqual([])
    expect(blank.index.size).toBe(0)
  })
})

describe('missingColumns', () => {
  it('reports nothing for the Tracker header', () => {
    expect(missingColumns(buildHeaderMap(TRACKER_HEADER), REQUIRED_APPLICATION_HEADERS)).toEqual([])
  })

  it('names the missing required columns in required order', () => {
    const map = buildHeaderMap(['notes', 'Role', 'Location'])
    expect(missingColumns(map, REQUIRED_APPLICATION_HEADERS)).toEqual([
      'Company',
      'Link',
      'Date Applied',
      'Status',
    ])
  })
})

describe('APPLICATION_COLUMNS', () => {
  it('lists the 13 Tracker columns in order, then Job ID', () => {
    expect(APPLICATION_COLUMNS.map(([, name]) => name)).toEqual([...TRACKER_HEADER, 'Job ID'])
  })
})

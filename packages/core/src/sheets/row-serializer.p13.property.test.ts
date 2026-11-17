// Feature: google-sheets-sync, Property 13: Serialize then parse is the identity
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ALL_APPLICATION_HEADERS, arbApplicationRow } from '../test/sheets-arbitraries'
import { buildHeaderMap } from './header'
import { parseApplicationRow } from './row-parser'
import { serializeApplicationRow } from './row-serializer'
import type { RawCell } from './types'

/** What the Sheet displays for a `stringValue` write: the value without one leading apostrophe. */
const display = (value: string): RawCell => ({
  text: value.startsWith("'") ? value.slice(1) : value,
  hyperlink: null,
  runLinks: [],
})

describe('Property 13: serialize then parse is the identity', () => {
  const map = buildHeaderMap(ALL_APPLICATION_HEADERS)

  it('returns the original row, formulas and Unicode included', () => {
    fc.assert(
      fc.property(arbApplicationRow, (row) => {
        const cells = serializeApplicationRow(row, map)
        expect(cells.ok).toBe(true)
        if (!cells.ok) return
        expect(parseApplicationRow(cells.value.map(display), map, row.rowNumber)).toEqual(row)
      }),
      { numRuns: 300 },
    )
  })
})

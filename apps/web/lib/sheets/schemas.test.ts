import { describe, expect, it } from 'vitest'
import { googleErrorSchema, spreadsheetSchema, toGrid, tokenSchema } from '@/lib/sheets/schemas'

const EMPTY = { text: '', hyperlink: null, runLinks: [] }

// Shaped like a `spreadsheets.get` response for the readSnapshot fields mask.
const response = {
  sheets: [
    {
      properties: {
        sheetId: 0,
        title: 'Tracker',
        gridProperties: { rowCount: 1000, columnCount: 12 },
      },
      data: [
        {
          rowData: [
            {
              values: [
                { formattedValue: 'Company' },
                { formattedValue: 'Role' },
                { formattedValue: 'Link' },
              ],
            },
            {
              values: [
                { formattedValue: 'Acme' },
                {},
                {
                  formattedValue: 'Apply here',
                  hyperlink: 'https://jobs.acme.com/123',
                },
              ],
            },
            {
              values: [
                { formattedValue: 'Globex' },
                { formattedValue: 'SWE Intern' },
                {
                  formattedValue: 'posting and careers',
                  textFormatRuns: [
                    { format: { link: { uri: 'https://globex.com/jobs/9' } } },
                    { startIndex: 7, format: {} },
                    { startIndex: 12, format: { link: { uri: 'https://globex.com/careers' } } },
                  ],
                },
              ],
            },
            {},
            { values: [{ formattedValue: 'Initech' }] },
          ],
        },
      ],
    },
    {
      properties: { sheetId: 42, title: 'Companies' },
      data: [{}],
    },
  ],
}

describe('spreadsheetSchema and toGrid', () => {
  const parsed = spreadsheetSchema.parse(response)
  const [tracker, companies] = parsed.sheets

  it('keeps cell hyperlinks and turns empty cells into empty Raw_Cells', () => {
    const grid = toGrid(tracker!)
    expect(grid[1]).toEqual([
      { text: 'Acme', hyperlink: null, runLinks: [] },
      EMPTY,
      { text: 'Apply here', hyperlink: 'https://jobs.acme.com/123', runLinks: [] },
    ])
  })

  it('collects rich-text run links, defaulting a missing startIndex to 0', () => {
    expect(toGrid(tracker!)[2]![2]).toEqual({
      text: 'posting and careers',
      hyperlink: null,
      runLinks: [
        { startIndex: 0, uri: 'https://globex.com/jobs/9' },
        { startIndex: 12, uri: 'https://globex.com/careers' },
      ],
    })
  })

  it('keeps rows ragged and maps a row without values to an empty row', () => {
    const grid = toGrid(tracker!)
    expect(grid.map((row) => row.length)).toEqual([3, 3, 3, 0, 1])
  })

  it('returns an empty grid when rowData or data is missing', () => {
    expect(toGrid(companies!)).toEqual([])
    expect(toGrid({ properties: { sheetId: 1, title: 'Empty' } })).toEqual([])
  })

  it('defaults a missing sheets array and rejects an unexpected shape', () => {
    expect(spreadsheetSchema.parse({})).toEqual({ sheets: [] })
    expect(spreadsheetSchema.safeParse({ sheets: [{ properties: { title: 7 } }] }).success).toBe(
      false,
    )
  })
})

describe('tokenSchema and googleErrorSchema', () => {
  it('accepts a token response and rejects an empty token', () => {
    expect(tokenSchema.safeParse({ access_token: 'tok', expires_in: 3599 }).success).toBe(true)
    expect(tokenSchema.safeParse({ access_token: '', expires_in: 3599 }).success).toBe(false)
  })

  it('parses a Sheets API error body', () => {
    const body = {
      error: {
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'The caller does not have permission',
      },
    }
    expect(googleErrorSchema.parse(body).error.code).toBe(403)
    expect(googleErrorSchema.safeParse({ error: 'invalid_grant' }).success).toBe(false)
  })
})

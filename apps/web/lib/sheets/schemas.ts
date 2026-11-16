import 'server-only'
import type { Grid, RawCell } from '@uni/core'
import { z } from 'zod'

// These schemas accept only what the `fields` masks request. Google omits empty values, so
// every field it can leave out is optional.

const cellSchema = z.object({
  formattedValue: z.string().optional(),
  hyperlink: z.string().optional(),
  textFormatRuns: z
    .array(
      z.object({
        // Google omits `startIndex` for the run that starts at 0.
        startIndex: z.number().int().nonnegative().optional(),
        format: z.object({ link: z.object({ uri: z.string() }).optional() }).optional(),
      }),
    )
    .optional(),
})

const sheetSchema = z.object({
  properties: z.object({
    sheetId: z.number().int(),
    title: z.string(),
    gridProperties: z
      .object({ rowCount: z.number().int(), columnCount: z.number().int() })
      .optional(),
  }),
  data: z
    .array(
      z.object({
        rowData: z.array(z.object({ values: z.array(cellSchema).optional() })).optional(),
      }),
    )
    .optional(),
})

/** Response of `spreadsheets.get`, for both the metadata and the grid data masks. */
export const spreadsheetSchema = z.object({ sheets: z.array(sheetSchema).default([]) })

/** Successful response of the OAuth token endpoint. */
export const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
})

/** Error body of the Sheets API. */
export const googleErrorSchema = z.object({
  error: z.object({
    code: z.number(),
    status: z.string().optional(),
    message: z.string().optional(),
  }),
})

export type SheetsCell = z.infer<typeof cellSchema>
export type SpreadsheetSheet = z.infer<typeof sheetSchema>

function toRawCell(cell: SheetsCell): RawCell {
  const runLinks: RawCell['runLinks'] = []
  for (const run of cell.textFormatRuns ?? []) {
    const uri = run.format?.link?.uri
    if (uri !== undefined) runLinks.push({ startIndex: run.startIndex ?? 0, uri })
  }
  return { text: cell.formattedValue ?? '', hyperlink: cell.hyperlink ?? null, runLinks }
}

/**
 * Converts one sheet of a `spreadsheets.get` response to the core Grid. Row 0 is sheet row 1.
 * Each request names one range per tab, so only the first GridData is used. Cells that Google
 * returns empty (`{}`) become empty Raw_Cells, and a row without `values` is an empty row.
 * Rows stay ragged, because Google drops trailing empty cells.
 */
export function toGrid(sheet: SpreadsheetSheet): Grid {
  const rows = sheet.data?.[0]?.rowData ?? []
  return rows.map((row) => (row.values ?? []).map(toRawCell))
}

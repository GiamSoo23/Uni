/**
 * Opt-in end-to-end check against the real Sheet (task 20.1). It writes one synthetic row with
 * Mark as applied, checks it, removes it with Undo, and checks that nothing else changed. The
 * first run also runs Sheet_Setup: the "Job ID" header and the Companies tab stay in the Sheet.
 *
 *   cd apps/web
 *   UNI_E2E=1 node --conditions=react-server --import tsx scripts/sheets-e2e.ts --confirm
 *
 * It reads `apps/web/.env.local` and prints check names, row numbers and failure categories
 * only: never the key, a token or the contents of the owner's rows.
 */
import { fileURLToPath } from 'node:url'
import {
  buildHeaderMap,
  buildNotes,
  createSheetsService,
  type Grid,
  type Job,
  jobIdFor,
  parseSheetsEnv,
  type SheetsGateway,
} from '@uni/core'
import { SheetsRestGateway } from '@/lib/sheets/rest-gateway'
import { ServiceAccountTokenProvider } from '@/lib/sheets/token'

const ENV_FILE = fileURLToPath(new URL('../.env.local', import.meta.url))
const USAGE = `This script writes to your real Google Sheet and removes its own row afterwards.
Run it only on purpose, from apps/web:

  UNI_E2E=1 node --conditions=react-server --import tsx scripts/sheets-e2e.ts --confirm`

interface Check {
  name: string
  ok: boolean
  detail?: string
}

const texts = (grid: Grid, index: number): string[] => (grid[index] ?? []).map((cell) => cell.text)

/** The row without its trailing empty cells, so an added empty column doesn't count as a change. */
const trimmed = (cells: readonly string[]): string[] => {
  const copy = [...cells]
  while (copy.length > 0 && copy.at(-1) === '') copy.pop()
  return copy
}

function lastNonEmptyRowIndex(grid: Grid): number {
  for (let index = grid.length - 1; index >= 0; index -= 1) {
    if (grid[index]?.some((cell) => cell.text !== '') === true) return index
  }
  return 0
}

/** 1-based rows in 2..`through` whose cells differ between the two reads. */
function changedDataRows(before: Grid, after: Grid, through: number): number[] {
  const changed: number[] = []
  for (let index = 1; index <= through; index += 1) {
    if (
      JSON.stringify(trimmed(texts(before, index))) !== JSON.stringify(trimmed(texts(after, index)))
    ) {
      changed.push(index + 1)
    }
  }
  return changed
}

/** The header may only gain cells to the right (the "Job ID" column added by Sheet_Setup). */
function headerKept(before: Grid, after: Grid): boolean {
  const old = trimmed(texts(before, 0))
  return old.every((text, index) => texts(after, 0)[index] === text)
}

async function freshGrid(gateway: SheetsGateway, tab: string): Promise<Grid> {
  const res = await gateway.readApplicationsFresh(tab)
  if (!res.ok) throw new Error(`fresh read failed: ${res.error.category} (${res.error.reason})`)
  return res.value.grid
}

function syntheticJob(stamp: number): Job {
  const now = new Date(stamp)
  return {
    id: `e2e-${stamp}`,
    source: 'simplify',
    company: 'UNI E2E TEST',
    // Starts with "=" so the check proves the value is stored as text, not a formula.
    title: `=1+1 Uni end-to-end test ${stamp}`,
    url: `https://example.com/uni-e2e/${stamp}`,
    locations: ['Remote'],
    terms: ['Summer 2027'],
    category: 'Software',
    sponsorship: 'unknown',
    degrees: [],
    active: true,
    postedAt: now,
    updatedAt: null,
  }
}

async function main(): Promise<number> {
  // Checked before reading .env.local, so the file can't opt in on the owner's behalf.
  if (process.env.UNI_E2E !== '1' || !process.argv.includes('--confirm')) {
    console.error(USAGE)
    return 2
  }
  try {
    process.loadEnvFile(ENV_FILE)
  } catch {
    console.error('Could not read apps/web/.env.local. See docs/SHEETS.md.')
    return 2
  }
  const config = parseSheetsEnv(process.env)
  if (config.mode === 'disabled') {
    const problems = config.problems.map(({ kind, name }) => `${kind} ${name}`).join('; ')
    console.error(`Google Sheet not connected: ${problems}.`)
    return 2
  }

  const tab = config.settings.applicationsTab
  const token = new ServiceAccountTokenProvider({
    clientEmail: config.clientEmail,
    privateKey: config.privateKey,
  })
  const gateway = new SheetsRestGateway({ spreadsheetId: config.sheetId, token })
  const service = createSheetsService({
    gateway,
    settings: config.settings,
    now: () => new Date(),
    randomSheetId: () => Math.floor(Math.random() * 2 ** 31),
    onWrite: () => {},
  })

  const job = syntheticJob(Date.now())
  const jobId = jobIdFor(job)
  const checks: Check[] = []
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push(detail === undefined ? { name, ok } : { name, ok, detail })
    return ok
  }
  let inserted = false
  let removed = false

  try {
    const before = await freshGrid(gateway, tab)
    const last = lastNonEmptyRowIndex(before)
    console.log(`Last non-empty row before the test: ${last + 1}. Test Job ID: ${jobId}`)

    const mark = await service.markAsApplied(job)
    inserted = mark.kind === 'success'
    check(
      'Mark as applied succeeds',
      inserted,
      mark.kind === 'error' ? `${mark.failure.category} (${mark.failure.reason})` : mark.kind,
    )
    if (!inserted) return report(checks)

    const afterMark = await freshGrid(gateway, tab)
    const header = buildHeaderMap(texts(afterMark, 0))
    const column = (name: string) => header.index.get(name.toLowerCase()) ?? -1
    const newIndex = last + 1
    const row = texts(afterMark, newIndex)
    const holders = afterMark.flatMap((cells, index) =>
      cells[column('Job ID')]?.text === jobId ? [index + 1] : [],
    )
    check(
      'the new row is right below the last row',
      holders.length === 1 && holders[0] === newIndex + 1,
      `rows with the Job ID: ${holders.join(', ') || 'none'}; expected ${newIndex + 1}`,
    )
    check(
      'Role reads as text, without the apostrophe',
      row[column('Role')] === job.title,
      `read “${row[column('Role')] ?? ''}”`,
    )
    check('Link reads exactly as written', row[column('Link')] === job.url)
    check('Notes read exactly as written', row[column('Notes')] === buildNotes(job.url))
    check('the header only gained columns', headerKept(before, afterMark))
    const touched = changedDataRows(before, afterMark, last)
    check(
      'no other row changed after the insert',
      touched.length === 0,
      touched.length === 0 ? undefined : `changed rows: ${touched.join(', ')}`,
    )

    const undo = await service.undoMarkAsApplied(jobId)
    removed = undo.kind === 'success'
    check(
      'Undo succeeds',
      removed,
      undo.kind === 'error'
        ? `${undo.failure.category} (${undo.failure.reason})`
        : undo.kind === 'not_unique'
          ? `found ${undo.found} rows`
          : undefined,
    )

    const afterUndo = await freshGrid(gateway, tab)
    const left = afterUndo.filter((cells) => cells[column('Job ID')]?.text === jobId).length
    check('the test row is gone', left === 0, `rows left with the Job ID: ${left}`)
    check('the last row is back where it was', lastNonEmptyRowIndex(afterUndo) === last)
    const changed = changedDataRows(before, afterUndo, last)
    check(
      'no other row changed after Undo',
      changed.length === 0,
      changed.length === 0 ? undefined : `changed rows: ${changed.join(', ')}`,
    )
  } catch (error) {
    check(
      'the run finished without an error',
      false,
      error instanceof Error ? error.message : 'unknown error',
    )
  } finally {
    if (inserted && !removed) {
      const cleanup = await service.undoMarkAsApplied(jobId).catch(() => null)
      const ok =
        cleanup?.kind === 'success' || (cleanup?.kind === 'not_unique' && cleanup.found === 0)
      check(
        'cleanup removed the test row',
        ok,
        ok ? undefined : `delete the row with Job ID ${jobId} by hand`,
      )
    }
  }
  return report(checks)
}

function report(checks: readonly Check[]): number {
  for (const { name, ok, detail } of checks) {
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined || ok ? '' : `: ${detail}`}`,
    )
  }
  const failed = checks.filter((item) => !item.ok).length
  console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`)
  return failed === 0 ? 0 : 1
}

// No top-level await: apps/web is CommonJS, so tsx compiles this file to CJS.
void main().then((code) => {
  process.exitCode = code
})

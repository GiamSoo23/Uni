import type { Job, SheetsService } from '@uni/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  config: { mode: 'enabled', clientEmail: 'uni@p.iam.gserviceaccount.com' } as {
    mode: 'enabled' | 'disabled'
    clientEmail?: string
  },
  service: null as SheetsService | null,
  jobs: [] as Partial<Job>[],
}))

vi.mock('@/lib/sheets', () => ({
  getSheetsConfig: () => mocks.config,
  getSheetsService: () => (mocks.config.mode === 'enabled' ? mocks.service : null),
}))
vi.mock('@/lib/jobs', () => ({ getListings: () => Promise.resolve({ jobs: mocks.jobs }) }))

const { markAsApplied, undoMarkAsApplied } = await import('@/app/sheets-actions')

const IDLE = { kind: 'idle' } as const
const OPEN = { id: 'open-role-1', active: true, company: 'Acme', title: 'SWE Intern' }
const CLOSED = { id: 'closed-role-1', active: false, company: 'Acme', title: 'Old Intern' }

function form(fields: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

let service: {
  markAsApplied: ReturnType<typeof vi.fn>
  undoMarkAsApplied: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  service = {
    markAsApplied: vi.fn(() => Promise.resolve({ kind: 'success', jobId: 'simplify:open-role-1' })),
    undoMarkAsApplied: vi.fn(() =>
      Promise.resolve({ kind: 'success', jobId: 'simplify:open-role-1' }),
    ),
  }
  mocks.service = service as unknown as SheetsService
  mocks.config = { mode: 'enabled', clientEmail: 'uni@p.iam.gserviceaccount.com' }
  mocks.jobs = [OPEN, CLOSED]
})

const noCalls = () => {
  expect(service.markAsApplied).not.toHaveBeenCalled()
  expect(service.undoMarkAsApplied).not.toHaveBeenCalled()
}

describe('markAsApplied', () => {
  it('passes the server’s own Job to the service', async () => {
    const result = await markAsApplied(IDLE, form({ jobId: 'simplify:open-role-1' }))
    expect(result).toEqual({ kind: 'success', jobId: 'simplify:open-role-1', status: 'Submitted' })
    expect(service.markAsApplied).toHaveBeenCalledWith(OPEN)
  })

  it.each([
    ['an unknown Job_ID', { jobId: 'simplify:missing-1' }],
    ['an inactive job', { jobId: 'simplify:closed-role-1' }],
    ['an extra company field', { jobId: 'simplify:open-role-1', company: 'Evil Corp' }],
    ['a malformed Job_ID', { jobId: 'open-role-1' }],
  ])('rejects %s without calling Google', async (_, fields) => {
    expect(await markAsApplied(IDLE, form(fields))).toMatchObject({
      kind: 'error',
      category: 'invalid_job',
    })
    noCalls()
  })

  it('returns not_configured in disabled mode', async () => {
    mocks.config = { mode: 'disabled' }
    expect(await markAsApplied(IDLE, form({ jobId: 'simplify:open-role-1' }))).toMatchObject({
      category: 'not_configured',
    })
    noCalls()
  })

  it('maps already_recorded and failures', async () => {
    service.markAsApplied.mockResolvedValueOnce({
      kind: 'already_recorded',
      jobId: 'simplify:open-role-1',
      status: 'Interview',
    })
    expect(await markAsApplied(IDLE, form({ jobId: 'simplify:open-role-1' }))).toEqual({
      kind: 'already_recorded',
      jobId: 'simplify:open-role-1',
      status: 'Interview',
    })
    service.markAsApplied.mockResolvedValueOnce({
      kind: 'error',
      failure: { category: 'permission_denied', httpStatus: 403, reason: 'PERMISSION_DENIED' },
    })
    const denied = await markAsApplied(IDLE, form({ jobId: 'simplify:open-role-1' }))
    expect(denied).toMatchObject({ kind: 'error', category: 'permission_denied' })
    expect(denied.kind === 'error' && denied.message).toContain('uni@p.iam.gserviceaccount.com')
  })

  it('turns a thrown error into a network error', async () => {
    service.markAsApplied.mockRejectedValueOnce(new Error('boom'))
    expect(await markAsApplied(IDLE, form({ jobId: 'simplify:open-role-1' }))).toMatchObject({
      category: 'network',
    })
  })
})

describe('undoMarkAsApplied', () => {
  it('deletes by Job_ID', async () => {
    expect(await undoMarkAsApplied(IDLE, form({ jobId: 'simplify:open-role-1' }))).toEqual({
      kind: 'success',
      jobId: 'simplify:open-role-1',
    })
    expect(service.undoMarkAsApplied).toHaveBeenCalledWith('simplify:open-role-1')
  })

  it('rejects invalid input and disabled mode without calling Google', async () => {
    expect(await undoMarkAsApplied(IDLE, form({ jobId: 'x' }))).toMatchObject({
      category: 'invalid_job',
    })
    mocks.config = { mode: 'disabled' }
    expect(await undoMarkAsApplied(IDLE, form({ jobId: 'simplify:open-role-1' }))).toMatchObject({
      category: 'not_configured',
    })
    noCalls()
  })

  it('reports not_unique with the count', async () => {
    service.undoMarkAsApplied.mockResolvedValueOnce({
      kind: 'not_unique',
      jobId: 'simplify:open-role-1',
      found: 2,
    })
    const result = await undoMarkAsApplied(IDLE, form({ jobId: 'simplify:open-role-1' }))
    expect(result).toMatchObject({ kind: 'error', category: 'not_unique' })
    expect(result.kind === 'error' && result.message).toContain('2 rows')
  })
})

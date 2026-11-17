import { describe, expect, it } from 'vitest'
import { appliedReducer, EMPTY_APPLIED_STATE, type AppliedAction } from '@/lib/applied-state'

const run = (...actions: AppliedAction[]) => actions.reduce(appliedReducer, EMPTY_APPLIED_STATE)
const JOB = 'simplify:abc123'

describe('appliedReducer', () => {
  it('marks a job pending, then confirms it with an Undo window', () => {
    expect(run({ type: 'pending', jobId: JOB }).get(JOB)).toEqual({ kind: 'pending' })
    const state = run(
      { type: 'pending', jobId: JOB },
      { type: 'confirm', jobId: JOB, status: 'Submitted', until: 10_000, undoable: true },
    )
    expect(state.get(JOB)).toEqual({
      kind: 'applied',
      status: 'Submitted',
      until: 10_000,
      undoable: true,
    })
  })

  it('reverts a job to having no entry', () => {
    const state = run(
      { type: 'confirm', jobId: JOB, status: 'Submitted', until: 10_000, undoable: true },
      { type: 'revert', jobId: JOB },
    )
    expect(state.has(JOB)).toBe(false)
    expect(appliedReducer(EMPTY_APPLIED_STATE, { type: 'revert', jobId: JOB })).toBe(
      EMPTY_APPLIED_STATE,
    )
  })

  it('closes the window only once its end is reached', () => {
    const confirmed = run({
      type: 'confirm',
      jobId: JOB,
      status: 'Submitted',
      until: 10_000,
      undoable: true,
    })
    expect(appliedReducer(confirmed, { type: 'expire', jobId: JOB, at: 9_999 })).toBe(confirmed)
    expect(appliedReducer(confirmed, { type: 'expire', jobId: JOB, at: 10_000 }).get(JOB)).toEqual({
      kind: 'applied',
      status: 'Submitted',
      until: null,
      undoable: false,
    })
  })

  it('ignores a stale timer after the job was marked again', () => {
    const state = run(
      { type: 'confirm', jobId: JOB, status: 'Submitted', until: 10_000, undoable: true },
      { type: 'revert', jobId: JOB },
      { type: 'confirm', jobId: JOB, status: 'Submitted', until: 25_000, undoable: true },
      { type: 'expire', jobId: JOB, at: 10_000 },
    )
    expect(state.get(JOB)).toMatchObject({ until: 25_000, undoable: true })
  })

  it('keeps already_recorded without Undo', () => {
    const state = run({
      type: 'confirm',
      jobId: JOB,
      status: 'Interview',
      until: 10_000,
      undoable: false,
    })
    expect(state.get(JOB)).toMatchObject({ status: 'Interview', undoable: false })
  })

  it('does not turn a confirmed job back into pending', () => {
    const confirmed = run({
      type: 'confirm',
      jobId: JOB,
      status: 'Submitted',
      until: 10_000,
      undoable: true,
    })
    expect(appliedReducer(confirmed, { type: 'pending', jobId: JOB })).toBe(confirmed)
  })

  it('never changes other jobs', () => {
    const state = run(
      { type: 'confirm', jobId: 'simplify:other', status: 'Submitted', until: 5, undoable: true },
      { type: 'pending', jobId: JOB },
      { type: 'revert', jobId: JOB },
    )
    expect([...state.keys()]).toEqual(['simplify:other'])
  })
})

/** How long Undo stays available after Mark as applied (10.6). */
export const UNDO_WINDOW_MS = 10_000

/** A role marked in this browser session. */
export type AppliedEntry =
  | { kind: 'pending' }
  | {
      kind: 'applied'
      /** Status text for the badge, such as "Submitted". */
      status: string
      /** Epoch ms when the Undo or notice window closes; null once it has closed. */
      until: number | null
      /** False for `already_recorded`: Uni didn't write the row, so there's nothing to undo. */
      undoable: boolean
    }

export type AppliedState = ReadonlyMap<string, AppliedEntry>

export type AppliedAction =
  | { type: 'pending'; jobId: string }
  | { type: 'confirm'; jobId: string; status: string; until: number; undoable: boolean }
  | { type: 'revert'; jobId: string }
  | { type: 'expire'; jobId: string; at: number }

export const EMPTY_APPLIED_STATE: AppliedState = new Map()

/**
 * Client-side state of Mark as applied and Undo. `pending` is the optimistic step, `confirm`
 * records the server's answer, `revert` restores the card (a failed mark or a done Undo), and
 * `expire` closes the window once `at` has reached its end.
 */
export function appliedReducer(state: AppliedState, action: AppliedAction): AppliedState {
  const current = state.get(action.jobId)
  switch (action.type) {
    case 'pending':
      return current?.kind === 'applied'
        ? state
        : withEntry(state, action.jobId, { kind: 'pending' })
    case 'confirm':
      return withEntry(state, action.jobId, {
        kind: 'applied',
        status: action.status,
        until: action.until,
        undoable: action.undoable,
      })
    case 'revert': {
      if (current === undefined) return state
      const next = new Map(state)
      next.delete(action.jobId)
      return next
    }
    case 'expire':
      if (current?.kind !== 'applied' || current.until === null || current.until > action.at) {
        return state
      }
      return withEntry(state, action.jobId, { ...current, until: null, undoable: false })
  }
}

function withEntry(state: AppliedState, jobId: string, entry: AppliedEntry): AppliedState {
  const next = new Map(state)
  next.set(jobId, entry)
  return next
}

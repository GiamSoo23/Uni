'use client'

import { useActionState } from 'react'
import {
  markAsApplied,
  undoMarkAsApplied,
  type MarkActionState,
  type UndoActionState,
} from '@/app/sheets-actions'
import { AppliedBadge } from '@/components/applied-badge'
import { useApplied } from '@/components/applied-context'
import { UNDO_WINDOW_MS } from '@/lib/applied-state'

const IDLE = { kind: 'idle' } as const

/**
 * Adds the role to the Sheet. The card shows it as pending at once, and the button stays
 * disabled until the server answers (10.4). Success shows the badge with Undo for 10 s;
 * `already_recorded` shows the Sheet's status with no Undo (10.2); an error restores the
 * button and names the category (8.14).
 */
export function MarkAppliedButton({ jobId }: { jobId: string }) {
  const { entry, markPending, dispatch } = useApplied(jobId)
  const [state, formAction, pending] = useActionState(
    async (previous: MarkActionState, form: FormData): Promise<MarkActionState> => {
      markPending(jobId)
      const result = await markAsApplied(previous, form)
      if (result.kind === 'success' || result.kind === 'already_recorded') {
        dispatch({
          type: 'confirm',
          jobId,
          status: result.status,
          until: Date.now() + UNDO_WINDOW_MS,
          undoable: result.kind === 'success',
        })
      } else {
        dispatch({ type: 'revert', jobId })
      }
      return result
    },
    IDLE,
  )

  if (entry?.kind === 'applied') {
    return (
      <div className="flex items-center gap-2">
        <AppliedBadge status={entry.status} />
        {entry.undoable && entry.until !== null && <UndoControl jobId={jobId} />}
      </div>
    )
  }

  const busy = pending || entry?.kind === 'pending'
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {busy ? 'Saving…' : 'Mark as applied'}
      </button>
      {state.kind === 'error' && !busy && (
        <p role="alert" className="max-w-64 text-right text-xs text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  )
}

/**
 * Deletes the row Uni just added. It disappears when the window closes (the provider's timer).
 * Success restores the card with the button and no badge (10.12). An error stays visible until
 * the window closes (10.13).
 */
export function UndoControl({ jobId }: { jobId: string }) {
  const { dispatch } = useApplied(jobId)
  const [state, formAction, pending] = useActionState(
    async (previous: UndoActionState, form: FormData): Promise<UndoActionState> => {
      const result = await undoMarkAsApplied(previous, form)
      if (result.kind === 'success') dispatch({ type: 'revert', jobId })
      return result
    },
    IDLE,
  )
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-medium text-blue-700 underline disabled:opacity-60 dark:text-blue-400"
      >
        {pending ? 'Undoing…' : 'Undo'}
      </button>
      {state.kind === 'error' && !pending && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {state.message}
        </span>
      )}
    </form>
  )
}

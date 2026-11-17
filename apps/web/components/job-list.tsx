'use client'

import { useEffect, useMemo, useOptimistic, useReducer, type ReactNode } from 'react'
import { AppliedContext, useApplied } from '@/components/applied-context'
import { UndoControl } from '@/components/mark-applied'
import { appliedReducer, EMPTY_APPLIED_STATE } from '@/lib/applied-state'

/**
 * Holds what was marked in this session. Confirmed changes live in a reducer, pending ones in
 * `useOptimistic` on top of it, so a failed mark falls back on its own. Each open window gets a
 * timer that closes it at its end (10.6).
 */
export function AppliedStateProvider({
  mode,
  children,
}: {
  mode: 'hide' | 'show'
  children: ReactNode
}) {
  const [confirmed, dispatch] = useReducer(appliedReducer, EMPTY_APPLIED_STATE)
  const [state, addOptimistic] = useOptimistic(confirmed, appliedReducer)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const [jobId, entry] of confirmed) {
      if (entry.kind !== 'applied' || entry.until === null) continue
      const at = entry.until
      timers.push(
        setTimeout(() => dispatch({ type: 'expire', jobId, at }), Math.max(0, at - Date.now())),
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [confirmed])

  const value = useMemo(
    () => ({
      mode,
      state,
      markPending: (jobId: string) => addOptimistic({ type: 'pending', jobId }),
      dispatch,
    }),
    [mode, state, addOptimistic],
  )
  return <AppliedContext value={value}>{children}</AppliedContext>
}

/**
 * Wraps one server-rendered card. In `hide` mode a role marked in this session collapses to a
 * one-line row while its window is open, then disappears (8.11, 10.6). In `show` mode the card
 * stays and its controls show the badge.
 */
export function AppliedGate({
  jobId,
  label,
  children,
}: {
  jobId: string
  /** Company and title, for the collapsed row. */
  label: string
  children: ReactNode
}) {
  const { mode, entry } = useApplied(jobId)
  if (mode === 'show' || entry === undefined || entry.kind === 'pending') return children
  if (entry.until === null) return null
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      <span>
        {entry.undoable ? 'Marked as applied' : `Already in your Sheet as “${entry.status}”`} ·{' '}
        {label}
      </span>
      {entry.undoable && <UndoControl jobId={jobId} />}
    </li>
  )
}

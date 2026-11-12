'use client'

import { useActionState } from 'react'
import { syncNow, type SyncState } from './actions'

export function SyncButton() {
  const [state, action, pending] = useActionState<SyncState | null>(syncNow, null)

  return (
    <form action={action} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? 'Syncing…' : 'Sync now'}
      </button>
      {state !== null && !pending && (
        <p
          role="status"
          className={`text-sm ${state.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

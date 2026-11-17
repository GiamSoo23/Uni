'use client'

import { createContext, use } from 'react'
import type { AppliedAction, AppliedEntry, AppliedState } from '@/lib/applied-state'

export interface AppliedContextValue {
  mode: 'hide' | 'show'
  state: AppliedState
  /** Optimistic: call inside the form action, before awaiting the server. */
  markPending: (jobId: string) => void
  dispatch: (action: AppliedAction) => void
}

export const AppliedContext = createContext<AppliedContextValue | null>(null)

export function useApplied(
  jobId: string,
): AppliedContextValue & { entry: AppliedEntry | undefined } {
  const context = use(AppliedContext)
  if (context === null) throw new Error('useApplied needs an AppliedStateProvider')
  return { ...context, entry: context.state.get(jobId) }
}

'use server'

import { revalidatePath } from 'next/cache'
import { getListings } from '@/lib/jobs'

export interface SyncState {
  ok: boolean
  message: string
}

const STATUS_MESSAGES = {
  downloaded: 'Done: downloaded a new version.',
  not_modified: 'Done: nothing changed since the last sync.',
  cache: 'Done.',
  stale: 'Couldn’t reach GitHub. Showing the last saved copy.',
} as const

/** The "Sync now" button: ignores the age of the local copy and asks GitHub. */
export async function syncNow(previous: SyncState | null): Promise<SyncState> {
  void previous
  try {
    const result = await getListings({ force: true })
    revalidatePath('/')
    return { ok: result.status !== 'stale', message: STATUS_MESSAGES[result.status] }
  } catch (error) {
    console.error('Sync now failed', error)
    return { ok: false, message: 'The sync failed. Check the server logs.' }
  }
}

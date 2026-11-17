'use server'

import {
  APPLIED_STATUS,
  jobIdFor,
  type FailureCategory,
  type Job,
  type SheetsFailure,
} from '@uni/core'
import { getListings } from '@/lib/jobs'
import { parseJobIdForm } from '@/lib/job-id-input'
import { failureText } from '@/lib/sheet-messages'
import { getSheetsConfig, getSheetsService } from '@/lib/sheets'

export type ActionErrorCategory = FailureCategory | 'invalid_job' | 'not_configured' | 'not_unique'

export type ActionError = { kind: 'error'; message: string; category: ActionErrorCategory }

export type MarkActionState =
  | { kind: 'idle' }
  | { kind: 'success'; jobId: string; status: string }
  | { kind: 'already_recorded'; jobId: string; status: string }
  | ActionError

export type UndoActionState = { kind: 'idle' } | { kind: 'success'; jobId: string } | ActionError

const invalidJob = (): ActionError => ({
  kind: 'error',
  category: 'invalid_job',
  message: 'This role isn’t in the current Simplify list, or it’s closed. Reload the page.',
})

const notConfigured = (): ActionError => ({
  kind: 'error',
  category: 'not_configured',
  message: 'Google Sheet not connected. See docs/SHEETS.md.',
})

function failed(failure: SheetsFailure): ActionError {
  const config = getSheetsConfig()
  const email = config.mode === 'enabled' ? config.clientEmail : undefined
  return { kind: 'error', category: failure.category, message: failureText(failure, email) }
}

const UNEXPECTED: SheetsFailure = {
  category: 'network',
  httpStatus: null,
  reason: 'unexpected_error',
}

/** The server's own Job for this Job_ID, when it is in the listings and still open (8.3, 8.4). */
async function findActiveJob(jobId: string): Promise<Job | null | 'unavailable'> {
  try {
    const listings = await getListings()
    return listings.jobs.find((job) => job.active && jobIdFor(job) === jobId) ?? null
  } catch {
    return 'unavailable'
  }
}

/**
 * Adds a row for the role to the Sheet. The form must hold only a valid `jobId` (8.2). Nothing
 * reaches Google when the Sheet isn't configured (8.13) or the role isn't an open listing (8.3).
 * The Sheet_Cache is cleared by the service after the write, so there is no `revalidatePath`.
 */
export async function markAsApplied(
  previous: MarkActionState,
  form: FormData,
): Promise<MarkActionState> {
  void previous
  const jobId = parseJobIdForm(form)
  if (jobId === null) return invalidJob()
  const service = getSheetsService()
  if (service === null) return notConfigured()

  const job = await findActiveJob(jobId)
  if (job === 'unavailable') {
    return {
      kind: 'error',
      category: 'network',
      message: 'Couldn’t load the Simplify listings to check this role. Try again.',
    }
  }
  if (job === null) return invalidJob()

  try {
    const result = await service.markAsApplied(job)
    switch (result.kind) {
      case 'success':
        return { kind: 'success', jobId, status: APPLIED_STATUS }
      case 'already_recorded':
        return { kind: 'already_recorded', jobId, status: result.status || 'Applied' }
      case 'error':
        return failed(result.failure)
    }
  } catch {
    return failed(UNEXPECTED)
  }
}

/** Deletes the row Uni added for this Job_ID, if exactly one has it (10.7 to 10.9). */
export async function undoMarkAsApplied(
  previous: UndoActionState,
  form: FormData,
): Promise<UndoActionState> {
  void previous
  const jobId = parseJobIdForm(form)
  if (jobId === null) return invalidJob()
  const service = getSheetsService()
  if (service === null) return notConfigured()

  try {
    const result = await service.undoMarkAsApplied(jobId)
    switch (result.kind) {
      case 'success':
        return { kind: 'success', jobId }
      case 'not_unique':
        return {
          kind: 'error',
          category: 'not_unique',
          message:
            result.found === 0
              ? 'Uni’s row for this role is no longer in your Sheet. Nothing was deleted.'
              : `${result.found} rows in your Sheet have this Job ID. Nothing was deleted; remove the extra rows by hand.`,
        }
      case 'error':
        return failed(result.failure)
    }
  } catch {
    return failed(UNEXPECTED)
  }
}

import { z } from 'zod'

/** A Job_ID as Uni writes it: `simplify:` plus the Simplify listing id (8.2). */
export const jobIdSchema = z
  .string()
  .min(10)
  .max(200)
  .regex(/^simplify:.+$/)

/** The whole form, which may hold `jobId` and nothing else. */
const inputSchema = z.strictObject({ jobId: jobIdSchema })

/** Prefix of the hidden fields Next.js adds to a server action form. */
const NEXT_ACTION_PREFIX = '$ACTION'

/**
 * The Job_ID of a Mark as applied or Undo form, or null when the form is not exactly one valid
 * `jobId` field. Next.js `$ACTION*` fields are ignored; any other field, a repeated `jobId` or a
 * file makes the form invalid (8.2, 10.9).
 */
export function parseJobIdForm(form: FormData): string | null {
  // A Map, then `Object.fromEntries`, so a field named `__proto__` is an own key that the strict
  // schema rejects instead of an assignment to the prototype.
  const fields = new Map<string, FormDataEntryValue>()
  for (const [key, value] of form.entries()) {
    if (key.startsWith(NEXT_ACTION_PREFIX)) continue
    if (fields.has(key)) return null
    fields.set(key, value)
  }
  const parsed = inputSchema.safeParse(Object.fromEntries(fields))
  return parsed.success ? parsed.data.jobId : null
}

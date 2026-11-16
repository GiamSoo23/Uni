import 'server-only'
import { parseSheetsEnv, type SheetsMode } from '@uni/core'

let cached: SheetsMode | undefined

/**
 * The Sheets configuration from `process.env` (Requirement 1), parsed once per process, so a
 * changed variable takes effect after a restart. `server-only` keeps it out of client bundles (1.11).
 */
export function getSheetsConfig(): SheetsMode {
  cached ??= parseSheetsEnv(process.env)
  return cached
}

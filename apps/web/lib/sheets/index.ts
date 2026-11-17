import 'server-only'
import { randomInt } from 'node:crypto'
import { createSheetsService, type SheetsMode, type SheetsService } from '@uni/core'
import { getSheetsConfig } from '@/lib/sheets/config'
import { SheetsRestGateway } from '@/lib/sheets/rest-gateway'
import {
  createSnapshotCache,
  type SheetState,
  type SnapshotCache,
} from '@/lib/sheets/snapshot-cache'
import { ServiceAccountTokenProvider } from '@/lib/sheets/token'

export { getSheetsConfig } from '@/lib/sheets/config'
export type { SheetState } from '@/lib/sheets/snapshot-cache'

/** Largest sheetId Uni picks for a new tab; the API takes non-negative 32-bit integers. */
const MAX_SHEET_ID = 2 ** 31 - 1

interface Wiring {
  config: SheetsMode
  cache: SnapshotCache
  /** Null in disabled mode: nothing may call Google then (8.13). */
  service: SheetsService | null
}

let wiring: Wiring | undefined

/**
 * One token provider, gateway, Sheet_Cache and service per server process, built on first use
 * from `getSheetsConfig()`. The cache, the tab directory and the keyed mutex are per process.
 */
function wire(): Wiring {
  if (wiring !== undefined) return wiring
  const config = getSheetsConfig()
  if (config.mode === 'disabled') {
    wiring = {
      config,
      cache: createSnapshotCache({ mode: 'disabled', problems: config.problems }),
      service: null,
    }
    return wiring
  }

  const token = new ServiceAccountTokenProvider({
    clientEmail: config.clientEmail,
    privateKey: config.privateKey,
  })
  const gateway = new SheetsRestGateway({ spreadsheetId: config.sheetId, token })
  const cache = createSnapshotCache({
    mode: 'enabled',
    gateway,
    applicationsTab: config.settings.applicationsTab,
    clientEmail: config.clientEmail,
  })
  const service = createSheetsService({
    gateway,
    settings: config.settings,
    now: () => new Date(),
    randomSheetId: () => randomInt(1, MAX_SHEET_ID),
    onWrite: () => cache.clearSheetCache(),
  })
  wiring = { config, cache, service }
  return wiring
}

/** The Sheet state for an inbox render: disabled, or the cached or freshly read snapshot. */
export function getSheetState(): Promise<SheetState> {
  return wire().cache.getSheetState()
}

/** Drops the Sheet_Cache so the next render reads the Sheet (12.4, 12.5). No-op when disabled. */
export function clearSheetCache(): void {
  wire().cache.clearSheetCache()
}

/** Mark as applied and Undo, or null when the Sheet is not configured. */
export function getSheetsService(): SheetsService | null {
  return wire().service
}

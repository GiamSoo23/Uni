import 'server-only'
import path from 'node:path'
import { createDescriptionReader } from '@uni/core'
import { cacheDir } from '@/lib/jobs'
import { createDescriptionStore } from './store'

export type { DescriptionCoverage } from './store'

/** One store per server process, next to the Simplify cache. */
export const descriptionStore = createDescriptionStore({
  file: path.join(cacheDir, 'descriptions', 'flags.json'),
  createReader: () => createDescriptionReader({ timeoutMs: 10_000 }),
})

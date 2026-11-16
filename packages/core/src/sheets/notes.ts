import { detectAts } from './ats'

/** The closing sentence of every Notes cell Uni writes. */
export const SIMPLIFY_NOTE = 'Found on the Simplify Summer 2027 GitHub list.'

/**
 * The Notes cell for a new row in the owner's style: `"<ATS>. "` followed by `SIMPLIFY_NOTE` when
 * the ATS_Detector names an ATS for `url`, otherwise `SIMPLIFY_NOTE` alone.
 */
export function buildNotes(url: string): string {
  const ats = detectAts(url)
  return ats === null ? SIMPLIFY_NOTE : `${ats}. ${SIMPLIFY_NOTE}`
}

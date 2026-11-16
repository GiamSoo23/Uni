/**
 * Applicant tracking systems the ATS_Detector knows, as `[name, domain]` pairs. No domain is a
 * suffix of another, so at most one entry matches a host.
 */
export const ATS_DOMAINS = [
  ['Workday', 'myworkdayjobs.com'],
  ['Workday', 'myworkdaysite.com'],
  ['Greenhouse', 'greenhouse.io'],
  ['Ashby', 'ashbyhq.com'],
  ['Lever', 'lever.co'],
  ['iCIMS', 'icims.com'],
  ['Oracle', 'oraclecloud.com'],
  ['SmartRecruiters', 'smartrecruiters.com'],
] as const

/** An ATS name from `ATS_DOMAINS`, spelled as listed. */
export type AtsName = (typeof ATS_DOMAINS)[number][0]

/**
 * The ATS that hosts `url`, or null. The lowercased host must equal an ATS domain or end with `.`
 * followed by it, so `boards.greenhouse.io` is Greenhouse and `notgreenhouse.io` is none. Strings
 * that don't parse as absolute URLs, and schemes other than http: and https:, give null.
 */
export function detectAts(url: string): AtsName | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const host = parsed.hostname.toLowerCase()
  for (const [name, domain] of ATS_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) return name
  }
  return null
}

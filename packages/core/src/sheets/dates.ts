/** True when the JavaScript runtime accepts `timeZone` as an IANA time zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

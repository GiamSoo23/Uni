const US_STATE_CODES = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
  'PR',
])

const US_STATE_NAMES = new Set([
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new hampshire',
  'new jersey',
  'new mexico',
  'new york',
  'north carolina',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south carolina',
  'south dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'west virginia',
  'wisconsin',
  'wyoming',
  'district of columbia',
  'washington dc',
  'washington, dc',
  'puerto rico',
])

/** City abbreviations that Simplify uses without a state. */
const US_CITY_ALIASES = new Set(['nyc', 'sf', 'la', 'south sf'])

const US_COUNTRY = /^(usa|us|u\.s\.a?\.?|united states( of america)?)$/i
const REMOTE_US = /^remote(\s*(in|-|,)?\s*(the\s+)?(usa|us|united states))?$/i

/**
 * Whether a Simplify location is in the US.
 *
 * Recognizes "City, ST", state names, "United States", "Remote in USA",
 * plain "Remote" and aliases like "NYC" or "SF". Any location that ends in
 * another country ("Toronto, ON, Canada", "Remote in UK") returns false.
 */
export function isUSLocation(location: string): boolean {
  const value = location.trim()
  if (value === '') return false

  const lower = value.toLowerCase()
  if (REMOTE_US.test(value)) return true
  if (US_COUNTRY.test(value)) return true
  if (US_STATE_NAMES.has(lower)) return true
  if (US_CITY_ALIASES.has(lower)) return true

  const parts = value.split(',').map((part) => part.trim())
  const last = parts.at(-1) ?? ''
  if (parts.length >= 2 && US_COUNTRY.test(last)) return true
  // "City, ST", and also "Arlington County, Arlington, VA". Canada and the UK end with the country.
  if (parts.length >= 2 && US_STATE_CODES.has(last)) return true
  if (parts.length === 2 && US_STATE_NAMES.has(last.toLowerCase())) return true
  return false
}

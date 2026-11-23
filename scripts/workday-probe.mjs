// Temporary probe (removed before merge): can this network read Workday's public posting API?
// It tries the same postings twice: with Node's default headers and with a browser's.
const LISTINGS =
  'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json'
const WORKDAY =
  /^https?:\/\/(([\w-]+)\.wd\d+\.myworkdayjobs\.com)\/(?:[a-z]{2}-[a-z]{2}\/)?([^/?#]+)\/(job\/[^?#]+)/i
const BROWSER = {
  accept: 'application/json',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const ip = await fetch('https://api.ipify.org')
  .then((r) => r.text())
  .catch(() => 'unknown')
console.log(`egress IP: ${ip}`)

const listings = await (await fetch(LISTINGS)).json()
const apis = []
const tenants = new Set()
for (const row of listings) {
  if (!row.active || !row.terms?.includes('Summer 2027')) continue
  const match = WORKDAY.exec(row.url)
  if (match === null || tenants.has(match[2])) continue
  tenants.add(match[2])
  apis.push(`https://${match[1]}/wday/cxs/${match[2]}/${match[3]}/${match[4]}`)
  if (apis.length === 20) break
}

async function get(url, headers) {
  return fetch(url, { headers, signal: AbortSignal.timeout(10_000) }).catch(() => null)
}

/** Browser headers, the Cloudflare cookie from earlier answers, and two retries after 4 s and 8 s. */
const jar = new Map()
async function patient(url) {
  const host = new URL(url).hostname
  for (const wait of [0, 4000, 8000]) {
    if (wait > 0) await sleep(wait)
    const cookie = jar.get(host)
    const response = await get(url, cookie ? { ...BROWSER, cookie } : BROWSER)
    const set = response?.headers.get('set-cookie')?.split(';')[0]
    if (set) jar.set(host, set)
    if (response?.status !== 429) return response?.status ?? 'error'
  }
  return 429
}

const variants = {
  default: async (url) => (await get(url, { accept: 'application/json' }))?.status ?? 'error',
  browser: async (url) => (await get(url, BROWSER))?.status ?? 'error',
  patient,
}
const counts = Object.fromEntries(Object.keys(variants).map((name) => [name, {}]))
for (const [index, url] of apis.entries()) {
  // Rotate the order so no variant always goes first.
  const names = Object.keys(variants)
  const order = [...names.slice(index % 3), ...names.slice(0, index % 3)]
  const line = []
  for (const name of order) {
    const status = await variants[name](url)
    counts[name][status] = (counts[name][status] ?? 0) + 1
    line.push(`${name}=${status}`)
    await sleep(2000)
  }
  console.log(`${new URL(url).hostname}  ${line.join('  ')}`)
}
for (const [name, result] of Object.entries(counts))
  console.log(`total ${name}: ${JSON.stringify(result)}`)

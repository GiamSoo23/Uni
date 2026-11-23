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
  if (apis.length === 15) break
}

for (const [label, headers] of [
  ['default headers', { accept: 'application/json' }],
  ['browser headers', BROWSER],
]) {
  const counts = {}
  for (const url of apis) {
    const status = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
      .then((r) => r.status)
      .catch((error) => error.name)
    counts[status] = (counts[status] ?? 0) + 1
    console.log(`${label}  ${status}  ${new URL(url).hostname}`)
    await sleep(1500)
  }
  console.log(`${label}: ${JSON.stringify(counts)}`)
}

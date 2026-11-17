// Checks that the Sheets docs, .env.example and .gitignore agree (Requirements 1.12, 1.13, 14.12).
// Run from the repo root: node scripts/check-sheets-docs.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const VARIABLES = [
  'UNI_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'UNI_RESUME_VERSION',
  'UNI_TIME_ZONE',
  'UNI_SHEET_TAB',
]
const CATEGORIES = ['permission_denied', 'not_found', 'rate_limited', 'network', 'invalid_sheet']
const DEFAULTS = ['America/New_York', 'Tracker']
const COMPANIES_COLUMNS = ['Company', 'Policy', 'Scope', 'Note', 'Evidence URL', 'Checked']
const POLICIES = [
  'accepts',
  'no_sponsorship',
  'us_person_required',
  'citizenship_required',
  'clearance_required',
]
const KEY_FILES = [
  'service-account.json',
  'apps/web/service-account-prod.json',
  'my-credentials.json',
]

/** What each document must mention. */
const EXPECTED = {
  'docs/SHEETS.md': [
    ...VARIABLES,
    ...CATEGORIES,
    ...DEFAULTS,
    ...COMPANIES_COLUMNS,
    ...POLICIES,
    'YYYY-MM-DD',
    'iam.disableServiceAccountKeyCreation',
    '`\\n`',
  ],
  'docs/DEPLOY.md': [...VARIABLES, ...DEFAULTS],
  'SECURITY.md': [
    'GOOGLE_PRIVATE_KEY',
    'https://www.googleapis.com/auth/spreadsheets',
    '.gitignore',
  ],
  'README.md': ['applied=hide', 'applied=show', 'docs/SHEETS.md', '10 seconds'],
}

const problems = []

for (const [file, needles] of Object.entries(EXPECTED)) {
  const text = readFileSync(file, 'utf8')
  for (const needle of needles) {
    if (!text.includes(needle)) problems.push(`${file} doesn't mention ${needle}`)
  }
}

const env = readFileSync('.env.example', 'utf8')
for (const name of VARIABLES) {
  if (!new RegExp(`^${name}=$`, 'm').test(env))
    problems.push(`.env.example needs "${name}=" with an empty value`)
}
if (env.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
  problems.push('.env.example must not contain GOOGLE_APPLICATION_CREDENTIALS')
}

for (const file of KEY_FILES) {
  try {
    execFileSync('git', ['check-ignore', '-q', file])
  } catch {
    problems.push(`.gitignore doesn't exclude ${file}`)
  }
}

if (problems.length > 0) {
  console.error(problems.map((problem) => `- ${problem}`).join('\n'))
  process.exit(1)
}
console.log('Sheets docs, .env.example and .gitignore agree.')

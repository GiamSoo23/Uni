import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Made-up values that pass validation. None of them is a real credential.
const FAKE_ENV = {
  UNI_SHEET_ID: 'abcdefghij_KLMNOPQRS-0123456789',
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'uni-test@example-project.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nnot-a-real-key\\n-----END PRIVATE KEY-----\\n',
  UNI_RESUME_VERSION: '',
  UNI_TIME_ZONE: '',
  UNI_SHEET_TAB: '',
} as const

async function loadGetSheetsConfig() {
  const mod = await import('@/lib/sheets/config')
  return mod.getSheetsConfig
}

describe('getSheetsConfig', () => {
  beforeEach(() => {
    // A fresh module per test resets the memoized value.
    vi.resetModules()
    for (const [name, value] of Object.entries(FAKE_ENV)) vi.stubEnv(name, value)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses process.env into enabled mode with defaults', async () => {
    const getSheetsConfig = await loadGetSheetsConfig()
    expect(getSheetsConfig()).toEqual({
      mode: 'enabled',
      sheetId: FAKE_ENV.UNI_SHEET_ID,
      clientEmail: FAKE_ENV.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----',
      settings: { resumeVersion: '', timeZone: 'America/New_York', applicationsTab: 'Tracker' },
    })
  })

  it('reports missing and invalid variables by name only', async () => {
    vi.stubEnv('UNI_SHEET_ID', '   ')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'not a pem')
    const getSheetsConfig = await loadGetSheetsConfig()
    const config = getSheetsConfig()
    expect(config).toMatchObject({
      mode: 'disabled',
      problems: [
        { name: 'UNI_SHEET_ID', kind: 'missing' },
        { name: 'GOOGLE_PRIVATE_KEY', kind: 'invalid' },
      ],
    })
    expect(JSON.stringify(config)).not.toContain('not a pem')
  })

  it('memoizes the first result for the life of the module', async () => {
    const getSheetsConfig = await loadGetSheetsConfig()
    const first = getSheetsConfig()
    vi.stubEnv('UNI_SHEET_ID', '')
    expect(getSheetsConfig()).toBe(first)
    expect(first.mode).toBe('enabled')
  })
})

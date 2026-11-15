import { z } from 'zod'
import { isValidTimeZone } from './dates'

export type SheetsEnvName = 'UNI_SHEET_ID' | 'GOOGLE_SERVICE_ACCOUNT_EMAIL' | 'GOOGLE_PRIVATE_KEY'

/** Optional settings, always present with defaults applied. */
export interface SheetsSettings {
  /** '' by default (1.6, 1.7). */
  resumeVersion: string
  /** 'America/New_York' by default (1.8, 1.9). */
  timeZone: string
  /** 'Tracker' by default (1.14, 1.15). */
  applicationsTab: string
}

export interface SheetsEnvProblem {
  name: SheetsEnvName
  kind: 'missing' | 'invalid'
}

export type SheetsMode =
  | {
      mode: 'enabled'
      sheetId: string
      clientEmail: string
      privateKey: string
      settings: SheetsSettings
    }
  | { mode: 'disabled'; problems: SheetsEnvProblem[]; settings: SheetsSettings }

export const DEFAULT_RESUME_VERSION = ''
export const DEFAULT_TIME_ZONE = 'America/New_York'
export const DEFAULT_APPLICATIONS_TAB = 'Tracker'
const MAX_SETTING_LENGTH = 100

const PEM_BEGIN = '-----BEGIN PRIVATE KEY-----'
const PEM_END = '-----END PRIVATE KEY-----'
const SERVICE_ACCOUNT_SUFFIX = '.iam.gserviceaccount.com'

/** One schema per required variable (1.3). Only success or failure is used, never the messages. */
const REQUIRED_SCHEMAS = {
  UNI_SHEET_ID: z
    .string()
    .min(20)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.email().max(254).endsWith(SERVICE_ACCOUNT_SUFFIX),
  GOOGLE_PRIVATE_KEY: z.string().startsWith(PEM_BEGIN).endsWith(PEM_END),
} as const satisfies Record<SheetsEnvName, z.ZodType<string>>

type Env = Readonly<Record<string, string | undefined>>

/** Trimmed value, or null when missing, empty or whitespace-only (1.1). */
function readTrimmed(env: Env, name: string): string | null {
  const value = env[name]?.trim() ?? ''
  return value === '' ? null : value
}

/**
 * Replaces every two-character `\n` with a newline (1.2). The result is trimmed again so a key
 * pasted from the service account JSON, which ends with an escaped `\n`, still ends with the
 * PEM end marker.
 */
function unescapeKey(value: string): string {
  return value.replaceAll('\\n', '\n').trim()
}

type RequiredResult = { ok: true; value: string } | { ok: false; problem: SheetsEnvProblem }

function readRequired(env: Env, name: SheetsEnvName): RequiredResult {
  const trimmed = readTrimmed(env, name)
  if (trimmed === null) return { ok: false, problem: { name, kind: 'missing' } }
  const value = name === 'GOOGLE_PRIVATE_KEY' ? unescapeKey(trimmed) : trimmed
  // safeParse keeps Zod's issues (which can echo the input) inside this function; only the
  // variable name and the kind leave it (1.5).
  return REQUIRED_SCHEMAS[name].safeParse(value).success
    ? { ok: true, value }
    : { ok: false, problem: { name, kind: 'invalid' } }
}

function readSettings(env: Env): SheetsSettings {
  const resumeVersion = readTrimmed(env, 'UNI_RESUME_VERSION')
  const timeZone = readTrimmed(env, 'UNI_TIME_ZONE')
  const applicationsTab = readTrimmed(env, 'UNI_SHEET_TAB')
  return {
    resumeVersion:
      resumeVersion !== null && resumeVersion.length <= MAX_SETTING_LENGTH
        ? resumeVersion
        : DEFAULT_RESUME_VERSION,
    timeZone: timeZone !== null && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
    applicationsTab:
      applicationsTab !== null && applicationsTab.length <= MAX_SETTING_LENGTH
        ? applicationsTab
        : DEFAULT_APPLICATIONS_TAB,
  }
}

/**
 * Reads the Sheets variables (Requirement 1). Pure: pass `process.env` from a server-only module.
 * The result never contains any part of an invalid or missing value.
 */
export function parseSheetsEnv(env: Env): SheetsMode {
  const settings = readSettings(env)
  const sheetId = readRequired(env, 'UNI_SHEET_ID')
  const clientEmail = readRequired(env, 'GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = readRequired(env, 'GOOGLE_PRIVATE_KEY')

  if (sheetId.ok && clientEmail.ok && privateKey.ok) {
    return {
      mode: 'enabled',
      sheetId: sheetId.value,
      clientEmail: clientEmail.value,
      privateKey: privateKey.value,
      settings,
    }
  }

  const problems: SheetsEnvProblem[] = []
  for (const result of [sheetId, clientEmail, privateKey]) {
    if (!result.ok) problems.push(result.problem)
  }
  return { mode: 'disabled', problems, settings }
}

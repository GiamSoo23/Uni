import 'server-only'
import { createPrivateKey, createSign, type KeyObject } from 'node:crypto'
import type { Result, SheetsFailure } from '@uni/core'
import { z } from 'zod'
import { tokenSchema } from '@/lib/sheets/schemas'

export const TOKEN_URL = 'https://oauth2.googleapis.com/token'
/** The only scope Uni requests (Requirement 1.10). */
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const JWT_BEARER_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
const ASSERTION_LIFETIME_S = 3600
const EXPIRY_MARGIN_S = 60
const TIMEOUT_MS = 10_000

// The OAuth endpoint reports errors as `{ error: 'invalid_grant' }`, unlike the Sheets API
// shape in `googleErrorSchema`, so this schema stays here.
const tokenErrorSchema = z.object({ error: z.string().regex(/^[a-z_]{1,64}$/) })

export interface AccessTokenProvider {
  getToken(): Promise<Result<string, SheetsFailure>>
}

export interface ServiceAccountTokenProviderOptions {
  clientEmail: string
  privateKey: string
  fetch?: typeof fetch
  /** Milliseconds since the epoch, like `Date.now`. */
  now?: () => number
}

const failure = (
  category: SheetsFailure['category'],
  httpStatus: number | null,
  reason: string,
): { ok: false; error: SheetsFailure } => ({ ok: false, error: { category, httpStatus, reason } })

const b64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url')

/**
 * Gets access tokens for the service account through the JWT bearer grant. Tokens are cached
 * until 60 s before they expire, and concurrent callers share one token request. Errors never
 * carry the key, the assertion or the token (Requirement 2.6).
 */
export class ServiceAccountTokenProvider implements AccessTokenProvider {
  readonly #clientEmail: string
  readonly #privateKeyPem: string
  readonly #fetch: typeof fetch
  readonly #now: () => number
  #key: KeyObject | null | undefined
  #cached: { token: string; expiresAt: number } | undefined
  #inFlight: Promise<Result<string, SheetsFailure>> | undefined

  constructor(opts: ServiceAccountTokenProviderOptions) {
    this.#clientEmail = opts.clientEmail
    this.#privateKeyPem = opts.privateKey
    this.#fetch = opts.fetch ?? globalThis.fetch
    this.#now = opts.now ?? Date.now
  }

  getToken(): Promise<Result<string, SheetsFailure>> {
    if (this.#cached && this.#now() < this.#cached.expiresAt) {
      return Promise.resolve({ ok: true, value: this.#cached.token })
    }
    this.#inFlight ??= this.#requestToken().finally(() => {
      this.#inFlight = undefined
    })
    return this.#inFlight
  }

  /** The key object is created once; a malformed key stays a failure without re-parsing. */
  #getKey(): KeyObject | null {
    if (this.#key === undefined) {
      try {
        this.#key = createPrivateKey(this.#privateKeyPem)
      } catch {
        this.#key = null
      }
    }
    return this.#key
  }

  #signAssertion(): string | null {
    const key = this.#getKey()
    if (!key) return null
    const iat = Math.floor(this.#now() / 1000)
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = b64url(
      JSON.stringify({
        iss: this.#clientEmail,
        scope: SHEETS_SCOPE,
        aud: TOKEN_URL,
        iat,
        exp: iat + ASSERTION_LIFETIME_S,
      }),
    )
    const unsigned = `${header}.${claims}`
    try {
      const signature = createSign('RSA-SHA256').update(unsigned).sign(key)
      return `${unsigned}.${b64url(signature)}`
    } catch {
      return null
    }
  }

  async #requestToken(): Promise<Result<string, SheetsFailure>> {
    const assertion = this.#signAssertion()
    if (!assertion) return failure('permission_denied', null, 'invalid_private_key')

    let res: Response
    try {
      res = await this.#fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: JWT_BEARER_GRANT, assertion }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (e) {
      const timedOut = e instanceof Error && e.name === 'TimeoutError'
      return failure('network', null, timedOut ? 'timeout' : 'connection_error')
    }

    const body: unknown = await res.json().catch(() => undefined)
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) {
        const parsed = tokenErrorSchema.safeParse(body)
        return failure(
          'permission_denied',
          res.status,
          parsed.success ? parsed.data.error : 'token_rejected',
        )
      }
      if (res.status === 429) return failure('rate_limited', res.status, 'token_rate_limited')
      return failure('network', res.status, 'token_endpoint_error')
    }

    const parsed = tokenSchema.safeParse(body)
    if (!parsed.success) return failure('invalid_sheet', res.status, 'unexpected_response')
    const { access_token, expires_in } = parsed.data
    this.#cached = {
      token: access_token,
      expiresAt: this.#now() + (expires_in - EXPIRY_MARGIN_S) * 1000,
    }
    return { ok: true, value: access_token }
  }
}

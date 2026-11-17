import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { SHEETS_SCOPE, ServiceAccountTokenProvider, TOKEN_URL } from '@/lib/sheets/token'

// A throwaway key generated per test run. No real credentials are used and Google is never called.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const CLIENT_EMAIL = 'uni-test@example-project.iam.gserviceaccount.com'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function setup(responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(responses.shift() ?? json(500, {})))
  let clock = 1_700_000_000_000
  const provider = new ServiceAccountTokenProvider({
    clientEmail: CLIENT_EMAIL,
    privateKey,
    fetch: fetchMock,
    now: () => clock,
  })
  return { provider, fetchMock, advance: (ms: number) => (clock += ms) }
}

describe('ServiceAccountTokenProvider', () => {
  it('posts a jwt-bearer grant whose JWT asks only for the spreadsheets scope', async () => {
    const { provider, fetchMock } = setup([json(200, { access_token: 'tok-1', expires_in: 3599 })])

    expect(await provider.getToken()).toEqual({ ok: true, value: 'tok-1' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(TOKEN_URL)
    const form = init!.body as URLSearchParams
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    const [header, claims] = form
      .get('assertion')!
      .split('.')
      .slice(0, 2)
      .map(
        (part) =>
          JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>,
      )
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(claims).toMatchObject({ iss: CLIENT_EMAIL, scope: SHEETS_SCOPE, aud: TOKEN_URL })
    expect(claims!.exp).toBe((claims!.iat as number) + 3600)
  })

  it('reuses the cached token until 60 s before expiry', async () => {
    const { provider, fetchMock, advance } = setup([
      json(200, { access_token: 'tok-1', expires_in: 3600 }),
      json(200, { access_token: 'tok-2', expires_in: 3600 }),
    ])

    await provider.getToken()
    advance(3539_000)
    expect(await provider.getToken()).toEqual({ ok: true, value: 'tok-1' })
    advance(1_000)
    expect(await provider.getToken()).toEqual({ ok: true, value: 'tok-2' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one in-flight token request between concurrent callers', async () => {
    const { provider, fetchMock } = setup([json(200, { access_token: 'tok-1', expires_in: 3600 })])

    const results = await Promise.all([
      provider.getToken(),
      provider.getToken(),
      provider.getToken(),
    ])

    expect(results).toEqual(Array.from({ length: 3 }, () => ({ ok: true, value: 'tok-1' })))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps invalid_grant and a malformed key to permission_denied', async () => {
    const { provider } = setup([json(400, { error: 'invalid_grant', error_description: 'x' })])
    expect(await provider.getToken()).toEqual({
      ok: false,
      error: { category: 'permission_denied', httpStatus: 400, reason: 'invalid_grant' },
    })

    const fetchMock = vi.fn<typeof fetch>()
    const broken = new ServiceAccountTokenProvider({
      clientEmail: CLIENT_EMAIL,
      privateKey: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----',
      fetch: fetchMock,
    })
    expect(await broken.getToken()).toMatchObject({
      ok: false,
      error: { category: 'permission_denied' },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

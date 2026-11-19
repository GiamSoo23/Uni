import { describe, expect, it, vi } from 'vitest'
import { createDescriptionReader } from './reader'

const GREENHOUSE = 'https://job-boards.greenhouse.io/acme/jobs/1'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('createDescriptionReader', () => {
  it('returns the description text', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(json({ content: '&lt;p&gt;No visa sponsorship.&lt;/p&gt;' })),
    )
    const reader = createDescriptionReader({ fetchImpl })
    await expect(reader.read(GREENHOUSE)).resolves.toEqual({
      kind: 'text',
      text: 'No visa sponsorship.',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs/1',
      expect.objectContaining({ redirect: 'error' }),
    )
  })

  it('never calls the network for an unsupported URL', async () => {
    const fetchImpl = vi.fn()
    const reader = createDescriptionReader({ fetchImpl })
    await expect(reader.read('https://careers.example.com/job/1')).resolves.toEqual({
      kind: 'unsupported',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([404, 410])('reports %s as gone', async (status) => {
    const reader = createDescriptionReader({ fetchImpl: () => Promise.resolve(json({}, status)) })
    await expect(reader.read(GREENHOUSE)).resolves.toEqual({ kind: 'gone' })
  })

  it.each([429, 403, 500])('reports %s as a failure with its status', async (status) => {
    const reader = createDescriptionReader({ fetchImpl: () => Promise.resolve(json({}, status)) })
    await expect(reader.read(GREENHOUSE)).resolves.toEqual({
      kind: 'failed',
      reason: `http_${status}`,
    })
  })

  it('reports a network error, a timeout and bad JSON without throwing', async () => {
    const network = createDescriptionReader({
      fetchImpl: () => Promise.reject(new TypeError('fetch failed')),
    })
    await expect(network.read(GREENHOUSE)).resolves.toEqual({ kind: 'failed', reason: 'network' })

    const timeout = createDescriptionReader({
      fetchImpl: () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')),
    })
    await expect(timeout.read(GREENHOUSE)).resolves.toEqual({ kind: 'failed', reason: 'timeout' })

    const badJson = createDescriptionReader({
      fetchImpl: () => Promise.resolve(new Response('<html>')),
    })
    await expect(badJson.read(GREENHOUSE)).resolves.toEqual({
      kind: 'failed',
      reason: 'invalid_json',
    })
  })

  it('downloads an Ashby board once for all its postings', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        json({
          jobs: [
            { id: '11111111-1111-1111-1111-111111111111', descriptionHtml: '<p>One</p>' },
            { id: '22222222-2222-2222-2222-222222222222', descriptionHtml: '<p>Two</p>' },
          ],
        }),
      ),
    )
    const reader = createDescriptionReader({ fetchImpl })
    const base = 'https://jobs.ashbyhq.com/acme'
    const [one, two, gone] = await Promise.all([
      reader.read(`${base}/11111111-1111-1111-1111-111111111111`),
      reader.read(`${base}/22222222-2222-2222-2222-222222222222/application`),
      reader.read(`${base}/33333333-3333-3333-3333-333333333333`),
    ])
    expect(one).toEqual({ kind: 'text', text: 'One' })
    expect(two).toEqual({ kind: 'text', text: 'Two' })
    expect(gone).toEqual({ kind: 'gone' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

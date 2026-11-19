import { descriptionFromResponse, descriptionSourceFor, type DescriptionSource } from './sources'

export type DescriptionRead =
  /** The URL isn't on an ATS Uni can read. */
  | { kind: 'unsupported' }
  | { kind: 'text'; text: string }
  /** The posting was removed: 404, 410, or no longer on its Ashby board. */
  | { kind: 'gone' }
  /** Timeout, network error, rate limit, server error or an unexpected answer. */
  | { kind: 'failed'; reason: string }

export interface DescriptionReaderOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export interface DescriptionReader {
  read(url: string): Promise<DescriptionRead>
}

type Fetched = { ok: true; body: unknown } | { ok: false; read: DescriptionRead }

/**
 * Reads posting descriptions through public ATS APIs. It never throws: every failure comes back
 * as a value. One reader shares each Ashby board between the postings on it, so create one per
 * scan rather than one per process.
 */
export function createDescriptionReader(options: DescriptionReaderOptions = {}): DescriptionReader {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 10_000
  const boards = new Map<string, Promise<Fetched>>()

  async function fetchJson(url: string): Promise<Fetched> {
    let response: Response
    try {
      response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      return { ok: false, read: { kind: 'failed', reason: timedOut ? 'timeout' : 'network' } }
    }
    if (response.status === 404 || response.status === 410) {
      return { ok: false, read: { kind: 'gone' } }
    }
    if (!response.ok) {
      return { ok: false, read: { kind: 'failed', reason: `http_${response.status}` } }
    }
    try {
      return { ok: true, body: await response.json() }
    } catch {
      return { ok: false, read: { kind: 'failed', reason: 'invalid_json' } }
    }
  }

  function fetchSource(source: DescriptionSource): Promise<Fetched> {
    if (source.ats !== 'ashby') return fetchJson(source.apiUrl)
    let board = boards.get(source.apiUrl)
    if (board === undefined) {
      board = fetchJson(source.apiUrl)
      boards.set(source.apiUrl, board)
    }
    return board
  }

  return {
    async read(url) {
      const source = descriptionSourceFor(url)
      if (source === null) return { kind: 'unsupported' }
      const fetched = await fetchSource(source)
      if (!fetched.ok) return fetched.read
      const parsed = descriptionFromResponse(source, fetched.body)
      switch (parsed.kind) {
        case 'text':
          return parsed
        case 'missing':
          return { kind: 'gone' }
        case 'shape':
          return { kind: 'failed', reason: 'shape' }
      }
    },
  }
}

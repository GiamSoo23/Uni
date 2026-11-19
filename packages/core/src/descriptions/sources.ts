import { z } from 'zod'
import { decodeEntities, htmlToText, normalizeText } from './text'

export type DescriptionAts = 'greenhouse' | 'lever' | 'ashby' | 'workday'

/** Where to read a posting's description through its ATS's public JSON API. */
export interface DescriptionSource {
  ats: DescriptionAts
  /** The public JSON endpoint. */
  apiUrl: string
  /** Ashby answers with the whole board: the posting to pick from it. */
  postingId: string | null
}

const GREENHOUSE =
  /^https?:\/\/(?:job-boards|boards)(\.eu)?\.greenhouse\.io\/([\w-]+)\/jobs\/(\d+)(?:[/?#]|$)/i
const LEVER = /^https?:\/\/jobs(\.eu)?\.lever\.co\/([\w.-]+)\/([0-9a-f-]{36})(?:[/?#]|$)/i
const ASHBY = /^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})(?:[/?#]|$)/i
const WORKDAY =
  /^https?:\/\/(([\w-]+)\.wd\d+\.myworkdayjobs\.com)\/(?:[a-z]{2}-[a-z]{2}\/)?([^/?#]+)\/(job\/[^?#]+)/i
const WORKDAY_SITE =
  /^https?:\/\/(wd\d+\.myworkdaysite\.com)\/(?:[a-z]{2}-[a-z]{2}\/)?recruiting\/([^/?#]+)\/([^/?#]+)\/(job\/[^?#]+)/i

/**
 * The public API for a posting URL from Greenhouse, Lever, Ashby or Workday, or null for any
 * other URL. Only these hosts are ever called, so a listing can't point Uni at another server.
 */
export function descriptionSourceFor(url: string): DescriptionSource | null {
  let match = GREENHOUSE.exec(url)
  if (match !== null) {
    // EU boards are served by the same API host.
    const [, , board, id] = match
    return {
      ats: 'greenhouse',
      apiUrl: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`,
      postingId: null,
    }
  }
  match = LEVER.exec(url)
  if (match !== null) {
    const [, eu = '', company, id] = match
    return {
      ats: 'lever',
      apiUrl: `https://api${eu}.lever.co/v0/postings/${company}/${id}`,
      postingId: null,
    }
  }
  match = ASHBY.exec(url)
  if (match !== null) {
    const [, board = '', id = ''] = match
    return {
      ats: 'ashby',
      apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(decodeURIComponent(board))}`,
      postingId: id.toLowerCase(),
    }
  }
  match = WORKDAY.exec(url)
  if (match !== null) {
    const [, host, tenant, site, path] = match
    return {
      ats: 'workday',
      apiUrl: `https://${host}/wday/cxs/${tenant}/${site}/${path}`,
      postingId: null,
    }
  }
  match = WORKDAY_SITE.exec(url)
  if (match !== null) {
    const [, host, tenant, site, path] = match
    return {
      ats: 'workday',
      apiUrl: `https://${host}/wday/cxs/${tenant}/${site}/${path}`,
      postingId: null,
    }
  }
  return null
}

const greenhouseSchema = z.object({ content: z.string() })

const leverSchema = z.object({
  descriptionPlain: z.string(),
  lists: z.array(z.object({ text: z.string().optional(), content: z.string() })).optional(),
  additionalPlain: z.string().optional(),
})

const ashbySchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      descriptionPlain: z.string().optional(),
      descriptionHtml: z.string().optional(),
    }),
  ),
})

const workdaySchema = z.object({
  jobPostingInfo: z.object({ jobDescription: z.string() }),
})

export type DescriptionParse =
  | { kind: 'text'; text: string }
  /** The Ashby board answered, but the posting isn't on it anymore. */
  | { kind: 'missing' }
  /** The answer doesn't have the expected shape. */
  | { kind: 'shape' }

const SHAPE: DescriptionParse = { kind: 'shape' }
const text = (value: string): DescriptionParse => ({ kind: 'text', text: value })

/** The description as plain text, from the JSON the source's API answered with. */
export function descriptionFromResponse(
  source: DescriptionSource,
  body: unknown,
): DescriptionParse {
  switch (source.ats) {
    case 'greenhouse': {
      const parsed = greenhouseSchema.safeParse(body)
      // Greenhouse escapes the HTML once more, so it's decoded before the tags are read.
      return parsed.success ? text(htmlToText(decodeEntities(parsed.data.content))) : SHAPE
    }
    case 'lever': {
      const parsed = leverSchema.safeParse(body)
      if (!parsed.success) return SHAPE
      const { descriptionPlain, lists = [], additionalPlain = '' } = parsed.data
      const listText = lists.map((list) => `${list.text ?? ''}\n${htmlToText(list.content)}`)
      return text(normalizeText([descriptionPlain, ...listText, additionalPlain].join('\n')))
    }
    case 'ashby': {
      const parsed = ashbySchema.safeParse(body)
      if (!parsed.success) return SHAPE
      const job = parsed.data.jobs.find((item) => item.id.toLowerCase() === source.postingId)
      if (job === undefined) return { kind: 'missing' }
      if (job.descriptionHtml !== undefined) return text(htmlToText(job.descriptionHtml))
      return job.descriptionPlain === undefined ? SHAPE : text(normalizeText(job.descriptionPlain))
    }
    case 'workday': {
      const parsed = workdaySchema.safeParse(body)
      return parsed.success ? text(htmlToText(parsed.data.jobPostingInfo.jobDescription)) : SHAPE
    }
  }
}

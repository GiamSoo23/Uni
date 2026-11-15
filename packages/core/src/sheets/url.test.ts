import { describe, expect, it } from 'vitest'
import { isHttpUrl, normalizeUrl } from './url'

describe('isHttpUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(isHttpUrl('https://boards.greenhouse.io/acme/jobs/1')).toBe(true)
    expect(isHttpUrl('HTTP://example.com')).toBe(true)
  })

  it('rejects other schemes, relative paths and free text', () => {
    for (const value of [
      'mailto:jobs@example.com',
      'ftp://example.com/a.pdf',
      'javascript:alert(1)',
      '/jobs/1',
      'example.com/careers',
      '//example.com/careers',
      'Applied via referral',
      '',
    ]) {
      expect(isHttpUrl(value)).toBe(false)
    }
  })
})

describe('normalizeUrl', () => {
  it('lowercases the scheme and host and strips one leading www.', () => {
    expect(normalizeUrl('HTTPS://WWW.Example.COM/Jobs/ABC')).toBe('https://example.com/Jobs/ABC')
  })

  it('drops the fragment, utm_* and ref parameters, and trailing slashes', () => {
    expect(
      normalizeUrl('https://example.com/jobs/1//?utm_source=x&b=2&ref=gh&a=1&utm_=y#apply'),
    ).toBe('https://example.com/jobs/1?b=2&a=1')
  })

  it('keeps the root path, the port, and parameters whose names only look like tracking', () => {
    expect(normalizeUrl('http://example.com:8080/?refid=3&UTM_x=1&xutm_a=2')).toBe(
      'http://example.com:8080/?refid=3&UTM_x=1&xutm_a=2',
    )
    expect(normalizeUrl('https://example.com/?utm_source=x')).toBe('https://example.com/')
  })

  it('treats encoded tracking names like plain ones and keeps other encodings unchanged', () => {
    expect(normalizeUrl('https://example.com/a?q=%7E+x&%72ef=1&utm%5Fid=2')).toBe(
      'https://example.com/a?q=%7E+x',
    )
  })

  it('keeps a host that is only www. plus a dot', () => {
    expect(normalizeUrl('https://www./a')).toBe('https://www./a')
  })

  it('returns null for values that are not http(s) URLs', () => {
    expect(normalizeUrl('mailto:jobs@example.com')).toBeNull()
    expect(normalizeUrl('example.com/careers')).toBeNull()
    expect(normalizeUrl('not a url')).toBeNull()
  })

  it('gives the same key for a URL with and without tracking noise', () => {
    expect(normalizeUrl('https://www.jobs.example.com/r/42/?ref=simplify#top')).toBe(
      normalizeUrl('https://jobs.example.com/r/42'),
    )
  })
})

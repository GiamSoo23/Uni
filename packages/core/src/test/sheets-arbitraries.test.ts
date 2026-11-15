import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '../companies/policy'
import { isHttpUrl } from '../sheets/url'
import {
  ALL_APPLICATION_HEADERS,
  addTrackingNoise,
  arbApplicationRow,
  arbCompanyVariant,
  arbHeaderPermutation,
  arbHttpUrl,
  arbRawCell,
  arbTrackingNoise,
} from './sheets-arbitraries'

const SAMPLES = 200

describe('sheets arbitraries', () => {
  it('arbApplicationRow meets the round-trip conditions of 4.4', () => {
    for (const row of fc.sample(arbApplicationRow, SAMPLES)) {
      expect(row.company !== '' || row.role !== '').toBe(true)
      if (row.linkUrl === null) {
        expect(isHttpUrl(row.linkText)).toBe(false)
      } else {
        expect(row.linkText).toBe(row.linkUrl)
        expect(isHttpUrl(row.linkUrl)).toBe(true)
      }
      for (const value of Object.values(row)) {
        if (typeof value === 'string') {
          expect(value).toBe(value.trim())
          expect(value.length).toBeLessThanOrEqual(50_000)
        }
      }
      expect(row.jobId).not.toBe('')
    }
  })

  it('arbApplicationRow includes formula-like prefixes', () => {
    const values = fc.sample(arbApplicationRow, SAMPLES).flatMap((row) => [row.notes, row.role])
    expect(values.some((value) => /^[=+\-@']/.test(value))).toBe(true)
  })

  it('arbHttpUrl gives http(s) URLs without www., fragment or tracking parameters', () => {
    for (const url of fc.sample(arbHttpUrl, SAMPLES)) {
      expect(isHttpUrl(url)).toBe(true)
      const parsed = new URL(url)
      expect(parsed.hostname.startsWith('www.')).toBe(false)
      expect(parsed.hash).toBe('')
      for (const name of parsed.searchParams.keys()) {
        expect(name === 'ref' || name.startsWith('utm_')).toBe(false)
      }
    }
  })

  it('addTrackingNoise keeps the URL valid and adds the requested noise', () => {
    const cases = fc.sample(fc.tuple(arbHttpUrl, arbTrackingNoise), SAMPLES)
    for (const [url, noise] of cases) {
      const noisy = new URL(addTrackingNoise(url, noise))
      expect(noisy.hostname.startsWith('www.')).toBe(noise.www)
      const names = [...noisy.searchParams.keys()].filter(
        (name) => name === 'ref' || name.startsWith('utm_'),
      )
      expect(names).toHaveLength(noise.params.length)
      if (noise.trailingSlash) expect(noisy.pathname.endsWith('/')).toBe(true)
      expect(noisy.hash === '').toBe(noise.fragment === null)
    }
  })

  it('arbHeaderPermutation is a permutation of the 14 columns', () => {
    for (const headers of fc.sample(arbHeaderPermutation, SAMPLES)) {
      expect([...headers].sort()).toEqual([...ALL_APPLICATION_HEADERS].sort())
    }
  })

  it('arbRawCell run links have distinct start indexes', () => {
    for (const cell of fc.sample(arbRawCell, SAMPLES)) {
      const starts = cell.runLinks.map((run) => run.startIndex)
      expect(new Set(starts).size).toBe(starts.length)
    }
  })

  it('arbCompanyVariant keeps the normalized company name', () => {
    for (const company of ['General Dynamics, Inc.', 'Lockheed Martin', '3M', '']) {
      for (const variant of fc.sample(arbCompanyVariant(company), 50)) {
        expect(normalizeCompanyName(variant)).toBe(normalizeCompanyName(company))
      }
    }
  })
})

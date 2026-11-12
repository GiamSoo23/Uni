import { describe, expect, it } from 'vitest'
import { isUSLocation } from './location'

describe('isUSLocation', () => {
  it.each([
    'San Francisco, CA',
    'Tampa, FL',
    'Washington, DC',
    'NYC',
    'SF',
    'South SF',
    'United States',
    'Remote in USA',
    'Remote',
    'California',
    'North Carolina',
    'Austin, Texas',
    'Seattle, WA, USA',
    'Arlington County, Arlington, VA',
    'Long Island City, Queens, NY',
  ])('recognizes "%s" as the US', (location) => {
    expect(isUSLocation(location)).toBe(true)
  })

  it.each([
    'Toronto, ON, Canada',
    'Vancouver, BC, Canada',
    'Canada',
    'Remote in UK',
    'London, UK',
    'Melbourn, Royston, UK',
    'United Kingdom',
    'Bangalore, India',
    '',
  ])('rejects "%s"', (location) => {
    expect(isUSLocation(location)).toBe(false)
  })
})

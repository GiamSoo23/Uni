import { describe, expect, it } from 'vitest'
import { detectAts } from './ats'

describe('detectAts', () => {
  it('names the ATS for its domain and its subdomains', () => {
    expect(detectAts('https://greenhouse.io/acme')).toBe('Greenhouse')
    expect(detectAts('https://boards.greenhouse.io/acme/jobs/1')).toBe('Greenhouse')
    expect(detectAts('https://company.wd5.myworkdayjobs.com/en-US/careers/job/1')).toBe('Workday')
    expect(detectAts('https://acme.wd1.myworkdaysite.com/recruiting')).toBe('Workday')
    expect(detectAts('https://jobs.ashbyhq.com/acme/1')).toBe('Ashby')
    expect(detectAts('https://jobs.lever.co/acme/1')).toBe('Lever')
    expect(detectAts('https://careers-acme.icims.com/jobs/1')).toBe('iCIMS')
    expect(detectAts('https://x.fa.us2.oraclecloud.com/hcmUI')).toBe('Oracle')
    expect(detectAts('http://jobs.smartrecruiters.com/Acme/1')).toBe('SmartRecruiters')
  })

  it('compares the host case-insensitively', () => {
    expect(detectAts('HTTPS://Boards.GreenHouse.IO/acme')).toBe('Greenhouse')
  })

  it('names none when the domain is only a substring of the last label', () => {
    expect(detectAts('https://notgreenhouse.io/acme')).toBeNull()
    expect(detectAts('https://greenhouse.io.example.com/acme')).toBeNull()
    expect(detectAts('https://example.com/greenhouse.io')).toBeNull()
  })

  it('names none for unparseable strings and non-http(s) schemes', () => {
    for (const value of [
      '',
      'not a url',
      'boards.greenhouse.io/acme',
      'ftp://boards.greenhouse.io/acme',
      'mailto:jobs@greenhouse.io',
    ]) {
      expect(detectAts(value)).toBeNull()
    }
  })
})

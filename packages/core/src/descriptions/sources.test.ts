import { describe, expect, it } from 'vitest'
import { descriptionFromResponse, descriptionSourceFor, type DescriptionSource } from './sources'

describe('descriptionSourceFor', () => {
  it.each([
    [
      'https://job-boards.greenhouse.io/muonspace/jobs/5247725007',
      'greenhouse',
      'https://boards-api.greenhouse.io/v1/boards/muonspace/jobs/5247725007',
    ],
    [
      'https://boards.greenhouse.io/spacex/jobs/8621763002?gh_jid=8621763002',
      'greenhouse',
      'https://boards-api.greenhouse.io/v1/boards/spacex/jobs/8621763002',
    ],
    [
      'https://job-boards.eu.greenhouse.io/imc/jobs/4823924101',
      'greenhouse',
      'https://boards-api.greenhouse.io/v1/boards/imc/jobs/4823924101',
    ],
    [
      'https://jobs.lever.co/palantir/d5486403-c050-4920-b2e0-91b69b61ebb2/apply',
      'lever',
      'https://api.lever.co/v0/postings/palantir/d5486403-c050-4920-b2e0-91b69b61ebb2',
    ],
    [
      'https://jobs.eu.lever.co/acme/d5486403-c050-4920-b2e0-91b69b61ebb2',
      'lever',
      'https://api.eu.lever.co/v0/postings/acme/d5486403-c050-4920-b2e0-91b69b61ebb2',
    ],
    [
      'https://jobs.ashbyhq.com/ellipsislabs/02136b22-35b1-4b3d-8bef-567c3380a849/application',
      'ashby',
      'https://api.ashbyhq.com/posting-api/job-board/ellipsislabs',
    ],
    [
      'https://salesforce.wd12.myworkdayjobs.com/Futureforce_Internships/job/California---San-Francisco/Summer-2027-Intern---Software-Engineer_JR340771',
      'workday',
      'https://salesforce.wd12.myworkdayjobs.com/wday/cxs/salesforce/Futureforce_Internships/job/California---San-Francisco/Summer-2027-Intern---Software-Engineer_JR340771',
    ],
    [
      'https://intel.wd1.myworkdayjobs.com/en-us/external/job/US-Oregon-Hillsboro/Software-Engineering---Intern_JR0286834',
      'workday',
      'https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/external/job/US-Oregon-Hillsboro/Software-Engineering---Intern_JR0286834',
    ],
    [
      'https://wd3.myworkdaysite.com/recruiting/brevanhoward/BH_ExternalCareers/job/New-York/Trading_JR101583',
      'workday',
      'https://wd3.myworkdaysite.com/wday/cxs/brevanhoward/BH_ExternalCareers/job/New-York/Trading_JR101583',
    ],
  ])('maps %s', (url, ats, apiUrl) => {
    expect(descriptionSourceFor(url)).toMatchObject({ ats, apiUrl })
  })

  it('keeps the Ashby posting ID to pick it from the board', () => {
    expect(
      descriptionSourceFor('https://jobs.ashbyhq.com/flint/39F9E665-7037-4dff-b77a-ff7039df2bfc'),
    ).toMatchObject({ postingId: '39f9e665-7037-4dff-b77a-ff7039df2bfc' })
  })

  it.each([
    'https://careers.huntingtoningalls.com/job/Pascagoula/1430053700/',
    'https://boards.greenhouse.io/embed/job_app?token=7905463',
    'https://job-boards.greenhouse.io.evil.example/acme/jobs/1',
    'https://evil.example/job-boards.greenhouse.io/acme/jobs/1',
    'https://acme.wd1.myworkdayjobs.com.evil.example/site/job/x',
    'ftp://jobs.lever.co/acme/d5486403-c050-4920-b2e0-91b69b61ebb2',
    'not a url',
  ])('returns null for %s', (url) => {
    expect(descriptionSourceFor(url)).toBeNull()
  })
})

const source = (ats: DescriptionSource['ats'], postingId: string | null = null) => ({
  ats,
  apiUrl: 'https://api.example.test',
  postingId,
})

describe('descriptionFromResponse', () => {
  it('reads Greenhouse content, which is escaped HTML', () => {
    expect(
      descriptionFromResponse(source('greenhouse'), {
        content: '&lt;p&gt;Must be a U.S.&amp;nbsp;citizen.&lt;/p&gt;',
      }),
    ).toEqual({ kind: 'text', text: 'Must be a U.S. citizen.' })
  })

  it('joins Lever description, lists and closing text', () => {
    expect(
      descriptionFromResponse(source('lever'), {
        descriptionPlain: 'About the role',
        lists: [{ text: 'Requirements', content: '<li>Must be a U.S. citizen</li>' }],
        additionalPlain: 'We do not sponsor visas.',
      }),
    ).toEqual({
      kind: 'text',
      text: 'About the role\nRequirements\nMust be a U.S. citizen\nWe do not sponsor visas.',
    })
  })

  it('picks the posting from an Ashby board', () => {
    const board = {
      jobs: [
        { id: 'aaa', descriptionHtml: '<p>Other role</p>' },
        { id: 'BBB', descriptionHtml: '<p>No visa sponsorship.</p>' },
      ],
    }
    expect(descriptionFromResponse(source('ashby', 'bbb'), board)).toEqual({
      kind: 'text',
      text: 'No visa sponsorship.',
    })
    expect(descriptionFromResponse(source('ashby', 'ccc'), board)).toEqual({ kind: 'missing' })
  })

  it('reads the Workday job description', () => {
    expect(
      descriptionFromResponse(source('workday'), {
        jobPostingInfo: { jobDescription: '<p>Ability to obtain a Secret clearance</p>' },
      }),
    ).toEqual({ kind: 'text', text: 'Ability to obtain a Secret clearance' })
  })

  it.each(['greenhouse', 'lever', 'ashby', 'workday'] as const)(
    'reports an unexpected %s answer as a shape problem',
    (ats) => {
      expect(descriptionFromResponse(source(ats, 'x'), { unexpected: true })).toEqual({
        kind: 'shape',
      })
    },
  )
})

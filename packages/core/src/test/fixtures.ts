import type { Job } from '../jobs/job'

/** Registro con la forma real de listings.json (verificada el 11 nov 2026). */
export function rawListing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: 'Simplify',
    category: 'Software',
    company_name: 'Salesforce',
    id: 'abc-123',
    title: 'Summer 2027 Intern - Software Engineer',
    active: true,
    terms: ['Summer 2027'],
    date_updated: 1794449277,
    date_posted: 1794355200,
    url: 'https://salesforce.wd12.myworkdayjobs.com/Futureforce_Internships/job/x_JR340771',
    locations: ['San Francisco, CA'],
    company_url: 'https://simplify.jobs/c/Salesforce',
    is_visible: true,
    sponsorship: 'Other',
    degrees: ["Bachelor's"],
    ...overrides,
  }
}

export function job(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    source: 'simplify',
    company: 'Acme',
    title: 'Software Engineer Intern',
    url: 'https://jobs.lever.co/acme/1',
    locations: ['Tampa, FL'],
    terms: ['Summer 2027'],
    category: 'Software',
    sponsorship: 'unknown',
    degrees: ["Bachelor's"],
    active: true,
    postedAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: null,
    ...overrides,
  }
}

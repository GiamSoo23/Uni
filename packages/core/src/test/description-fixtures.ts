/**
 * Short excerpts of real postings, copied on Nov 19, 2026 from their public ATS pages. Only the
 * paragraphs about eligibility are kept, plus equal opportunity boilerplate where it mentions
 * citizenship, because the detector must skip it.
 */
export interface DescriptionFixture {
  company: string
  url: string
  text: string
}

export const MUON_SPACE: DescriptionFixture = {
  company: 'Muon Space',
  url: 'https://job-boards.greenhouse.io/muonspace/jobs/5247725007',
  text: [
    'We believe in equal employment opportunity regardless of race, color, ancestry, religion, sex, age, national origin, citizenship, sexual orientation, marital status, disability, or gender identity.',
    'ITAR/EAR Requirements',
    'This position requires access to export controlled information. To conform to U.S. Government export regulations applicable to that information, applicant must either be (A) a U.S. person, defined as a (i) U.S. citizen or national, (ii) U.S. lawful, permanent resident (green card holder), (iii) refugee under 8 U.S.C. § 1157, or (iv) asylee under 8 U.S.C. § 1158, (B) eligible to access the export controlled information without a required export authorization, or (C) eligible and reasonably likely to obtain the required export authorization from the applicable U.S. government agency.',
  ].join('\n'),
}

export const HUNTINGTON_INGALLS: DescriptionFixture = {
  company: 'Huntington Ingalls Industries',
  url: 'https://careers.huntingtoningalls.com/job/Pascagoula-2027-COLLEGE-SUMMER-INTERN-COMPUTER-ENGINEERING-Miss/1430053700/',
  text: [
    'Team: 52 Engineering',
    'Entity: Ingalls Shipbuilding',
    'US Citizenship Required for this Position: No',
    'Relocation: No relocation assistance available',
    'All qualified applicants will receive consideration for employment without regard to race, color, religion, gender, gender identity or expression, sexual orientation, national origin, physical or mental disability, age, or veteran status or any other basis protected by federal, state, or local law.',
  ].join('\n'),
}

export const BOOZ_ALLEN: DescriptionFixture = {
  company: 'Booz Allen',
  url: 'https://bah.wd1.myworkdayjobs.com/bah_jobs/job/Lexington-MA/University---2027-Summer-Games-Systems-Engineer-Intern---Lexington--MA_R0252273',
  text: [
    'Teams have also helped to develop an app that gives military commanders an easy way to track real-time and open-source information about developing situations.',
    'Ability to obtain a Secret clearance',
    'Clearance:',
  ].join('\n'),
}

export const ANDURIL: DescriptionFixture = {
  company: 'Anduril',
  url: 'https://boards.greenhouse.io/andurilindustries/jobs/5148079007',
  text: 'Must be a U.S. Person due to required access to U.S. export-controlled information or facilities; U.S. clearance eligibility may be required depending on program.',
}

export const ASTRANIS: DescriptionFixture = {
  company: 'Astranis',
  url: 'https://job-boards.greenhouse.io/astranis/jobs/4704598006',
  text: [
    'Today Astranis satellites provide dedicated, secure networks to highly-sophisticated customers across the globe – large enterprises, sovereign governments, and the US military.',
    'U.S. Citizenship, Lawful Permanent Residency, or Refugee/Asylee Status Required',
  ].join('\n'),
}

export const FLINT: DescriptionFixture = {
  company: 'Flint',
  url: 'https://jobs.ashbyhq.com/flint/39f9e665-7037-4dff-b77a-ff7039df2bfc',
  text: 'You must already be authorized to work in the United States for the whole term. We don’t sponsor visas for internships, and the application asks you to confirm this.',
}

export const SCOUT_MOTORS: DescriptionFixture = {
  company: 'Scout Motors',
  url: 'https://job-boards.greenhouse.io/scoutmotors/jobs/5287137007',
  text: 'Housing, Relocation & Sponsorship: Interns are responsible for their own housing and transportation. Scout Motors does not provide housing assistance, relocation, or visa sponsorship for internship positions.',
}

export const ADDEPAR: DescriptionFixture = {
  company: 'Addepar',
  url: 'https://job-boards.greenhouse.io/addepar1/jobs/8927531002',
  text: 'Applicants must be legally authorized to work in the United States for any employer without requiring current or future visa sponsorship (for example, employment-based visas such as H-1B, F-1/OPT, or similar), and must be authorized to begin work in the U.S. on their first day of employment.',
}

export const VERKADA: DescriptionFixture = {
  company: 'Verkada',
  url: 'https://job-boards.greenhouse.io/verkada/jobs/5211595007',
  text: 'We do sponsor and take over sponsorship of employment visas for this role. If we make you an offer, we will make every reasonable effort to get you a visa.',
}

export const CLOUDFLARE: DescriptionFixture = {
  company: 'Cloudflare',
  url: 'https://boards.greenhouse.io/cloudflare/jobs/8199958',
  text: [
    'This position may require access to information protected under U.S. export control laws, including the U.S. Export Administration Regulations. Please note that any offer of employment may be conditioned on your authorization to receive software or technology controlled under these U.S. export laws without sponsorship for an export license.',
    "All qualified applicants will be considered for employment without regard to their, or any other person's, perceived or actual race, color, religion, sex, gender, gender identity, gender expression, sexual orientation, national origin, ancestry, citizenship, age, physical or mental disability, medical condition, family care status, or any other basis protected by law.",
  ].join('\n'),
}

export const MARVELL: DescriptionFixture = {
  company: 'Marvell',
  url: 'https://marvell.wd1.myworkdayjobs.com/MarvellCareers/job/Santa-Clara-CA/Hardware-Signal-Integrity-Intern--MS---Summer-2027_2603877-1',
  text: 'This position may require access to technology and/or software subject to U.S. export control laws and regulations, including the Export Administration Regulations (EAR). As such, applicants must be eligible to access export-controlled information as defined under applicable law. Except for U.S. citizens, lawful permanent residents, or protected individuals as defined by 8 U.S.C. 1324b(a)(3), all applicants may be subject to an export license review process prior to employment.',
}

export const CAPITAL_ONE: DescriptionFixture = {
  company: 'Capital One',
  url: 'https://capitalone.wd12.myworkdayjobs.com/Capital_One/job/New-York-NY/Current-PhD--AI-Engineering-Internship-Program---Summer-2027_R249110-1',
  text: 'This is a limited-time internship position, and Capital One will not sponsor a new applicant for employment authorization for this position. However, a full-time AI Engineering role, for which you may be considered upon completion of the internship (subject to business need, market conditions, and other factors) is eligible for employer immigration sponsorship.',
}

export const RELIABLE_ROBOTICS: DescriptionFixture = {
  company: 'Reliable Robotics',
  url: 'https://jobs.ashbyhq.com/reliable-robotics/0af72d5a-87b7-49a1-b49e-424d28758c9e',
  text: [
    'This position requires access to information that is subject to U.S. export controls. An offer of employment will be contingent upon the applicant’s capacity to perform in compliance with U.S. export control laws.',
    'All applicants are asked to provide documentation that legally establishes status as a U.S. person or non-U.S. person (and nationalities in the case of a non-U.S. person). Where the applicant is not a U.S. person, meaning not a (i) U.S. citizen or national, (ii) U.S. lawful permanent resident, (iii) refugee under 8 U.S.C. § 1157, or (iv) asylee under 8 U.S.C. § 1158, or not otherwise permitted to access the export-controlled technology without U.S. government authorization, the Company reserves the right not to apply for an export license for such applicants whose access to export-controlled technology or software source code requires authorization and may decline to proceed with the application process and any offer of employment on that basis.',
  ].join('\n'),
}

# Uni: project plan

Last updated: Nov 12, 2026.

## Decisions

| Topic           | Decision                                                                                |
| --------------- | --------------------------------------------------------------------------------------- |
| Name            | Uni                                                                                     |
| Shape           | A web app from day one (Next.js), with no CLI-only steps                                |
| Priority        | Find open roles that fit and accept international students                              |
| Main source     | `listings.json` from the SimplifyJobs/Summer2027-Internships repo                       |
| Frequency       | Automatic weekly sync, plus a "Sync now" button                                         |
| Google Sheet    | The app may change it: it adds a `Job ID` column and creates a Companies tab            |
| Google access   | A service account (the Sheet is shared with its email)                                  |
| Online          | Vercel Hobby with Vercel Authentication on every deployment: only the owner can open it |
| AI              | Claude, with each user's own key. A mode without AI is available                        |
| Out of scope v1 | Automating Handshake or LinkedIn, filling in application forms, reading email           |

## Target flow

1. Upload your resume once, and the app picks out your interests.
2. Every week, or with "Sync now", it fetches new roles, drops the ones that don't fit and ranks the rest.
3. You see each role with a direct link to apply.
4. "Mark as applied" adds the row to your Sheet in your format.
5. A Companies tab keeps 100 to 150 companies with their careers portal, and the app tells you when a company with no open role opens one.

## Verified data (Nov 11, 2026)

- `listings.json`: 17,658 records; 828 active Software roles for Summer 2027 from 378 companies; about 87 new per week.
- The `sponsorship` field says "Other" for 5,339 of 5,354 active roles, so the job description has to be read.
- The repo declares no license: its data is not redistributed.
- Portals behind those 828 roles: Workday 286, other 232, Greenhouse 113, Ashby 66, iCIMS 47, Oracle 34, Lever 19.
- Workday's JSON endpoint (`/wday/cxs/...`) returns the description, but it isn't official.
- The tracker Sheet: 13 columns, 192 companies, 35 notes about sponsorship. 49 cells are hyperlinks that the CSV export loses, so they're read with the Sheets API.
- Sheets API: free; 300 reads and 300 writes per minute per project, 60 per user.
- USCIS publishes H-1B data per employer as CSV.

## How "accepts international students" is decided

| Priority | Signal                | Source                                                                                         |
| -------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| 1        | What you recorded     | Notes in your Sheet                                                                            |
| 2        | What the posting says | Description read by Claude, with the exact quote                                               |
| 3        | Simplify's field      | `sponsorship`                                                                                  |
| 4        | The company's history | USCIS H-1B CSV (a weak signal: it shows future sponsorship, not acceptance for the internship) |

Postings that explicitly say "no" are hidden. Postings that say nothing are shown with a label.

## Milestones (at 4 hours a week)

Each phase is a GitHub milestone with its issues. Work lands through a branch and a pull request that closes the issue, the same way as in Mox.

| Milestone | Phase                                                                                     | Hours | Status      |
| --------- | ----------------------------------------------------------------------------------------- | ----- | ----------- |
| M0        | Foundation: monorepo, strict TS, lint, Vitest, gitleaks, CI, labels and milestones        | 3-4   | Done        |
| M1        | Simplify source and job inbox: ETag cache, Zod, filters, Sync now                         | 6-8   | Done        |
| M2        | Private deployment: Vercel with Vercel Authentication on every deployment                 | 1-2   | In progress |
| M3        | Google Sheets: service account, hyperlinks, Mark as applied, `Job ID`, hide applied roles | 6-8   |             |
| M4        | Full inbox: Not interested (Postgres + Prisma), states                                    | 6-8   |             |
| M5        | Profile from the resume with Claude, eligibility, own key                                 | 5-6   |             |
| M6        | Evaluation: descriptions per ATS, sponsorship with a quote, score, cache, Batch           | 8-10  |             |
| M7        | Company signals: Sheet notes and the H-1B CSV                                             | 4-5   |             |
| M8        | Companies: portals derived from the links, top 100-150, Companies tab, watching NO ROLE   | 6-8   |             |
| M9        | AWS with CDK: weekly Scheduler, Lambda, SQS, DLQ, Budgets, OIDC                           | 10-12 |             |
| M10       | Alerts: weekly digest through a Discord webhook                                           | 3-4   |             |
| M11       | Open source v0.1: README, ARCHITECTURE.md, adapter guide, sample Sheet                    | 5-6   |             |

## Costs

- Simplify, ATS APIs, Sheets, USCIS, the AWS free tier, Neon and Vercel Hobby: $0.
- Claude (Haiku 4.5 at $1 and $5 per million tokens): about $3 to evaluate the current roles and about $0.30 a week. This is an estimate; the app will record the real token counts.

## Risks

| Risk                                      | Mitigation                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Simplify changes the JSON format          | Zod fails with a clear message and the last good copy stays in use      |
| Workday changes its endpoint              | The role shows without an evaluation, with its link                     |
| Few postings mention sponsorship          | A "not stated" label plus company signals, never an automatic exclusion |
| Manual and app edits collide in the Sheet | The app only appends rows and updates its own rows by `Job ID`          |
| Personal data in the repo                 | gitleaks, `.gitignore`, sample data                                     |

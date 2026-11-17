# Uni

Uni puts open internships on one page, hides the ones that don't accept international students, and links straight to each application.

> Status: M2 done, M3 in review, part of M8 pulled forward. The job inbox runs privately on Vercel, hides roles from companies that rule out international students, and syncs with your Google Sheet. Claude evaluation comes next. The plan is in [PLAN.md](PLAN.md) and progress is tracked in the [milestones](https://github.com/GiamSoo23/Uni/milestones).

## What it does today

- Downloads `listings.json` from [SimplifyJobs/Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships). It refreshes once a week or when you press **Sync now**, and uses an ETag so it doesn't download ~13 MB again when nothing changed.
- Validates every record with Zod and drops the ones that don't match the schema. If a download fails, it keeps showing the last good copy.
- Filters by term, category, region (US and US remote), posting date and text.
- Hides roles international students can't apply to, and labels every role with where that answer comes from.
- Connects to the Google Sheet where you track applications. It's optional: without it, the inbox works as before.

## Your Google Sheet

With your Sheet connected ([setup guide](docs/SHEETS.md)):

- **Roles you already applied to are hidden.** A role counts as applied when a row matches it by Job ID, link, or company and role, and its Status shows you applied. The **Applied** filter switches between `applied=hide` (the default) and `applied=show`, which keeps those roles with their Status as a badge.
- **Mark as applied** adds a row right below your last one, with Status `Submitted`, today's date and the link. **Undo** shows for 10 seconds and deletes that row.
- **Your Companies tab wins over the public list.** A row there with a policy such as `no_sponsorship` decides eligibility for that company, and the role shows "· your Sheet".
- **The inbox keeps working without the Sheet.** If it isn't configured, or Google fails, Uni lists every role and says why.

## How eligibility is decided

Simplify marks almost every role as "Other" for sponsorship, so its flag alone hides very few roles. Uni checks two sources, in this order:

1. **Simplify's flag for the role:** "Does Not Offer Sponsorship", "U.S. Citizenship is Required" or "Offers Sponsorship".
2. **The company's policy**, from a [sourced list](packages/core/src/companies/policies.json): `accepts`, `no_sponsorship`, `us_person_required`, `citizenship_required` or `clearance_required`. Each entry quotes a current posting, with its URL and the date it was checked.

If neither says anything, the role shows **Eligibility not verified**: nobody has checked it yet, which doesn't mean it accepts international students. On Nov 12, 2026, the company list hid 52 of the 721 Software roles for Summer 2027 in the US, from defense contractors that require U.S. citizenship, U.S. person status or a security clearance.

Your own Google Sheet can override the list with its [Companies tab](docs/SHEETS.md#the-companies-tab), and Claude will read each job description (M6). To add a company, see [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-company-policy).

## Requirements

- Node.js 24 (see `.nvmrc`)
- npm 11

## Run it locally

```bash
npm install
cp .env.example apps/web/.env.local   # optional
npm run dev                            # http://127.0.0.1:3000
```

The first visit downloads the data and takes a few seconds. The copy is saved in `apps/web/.cache/`, which is not committed.

## Online, just for you

Uni deploys to Vercel (Hobby plan, free) with Vercel Authentication on every deployment, so only people with access to the Vercel project can open it. The steps are in [docs/DEPLOY.md](docs/DEPLOY.md).

## Commands

| Command          | What it does                                     |
| ---------------- | ------------------------------------------------ |
| `npm run dev`    | Development server                               |
| `npm run check`  | Lint, typecheck and tests for the whole monorepo |
| `npm run build`  | Production build                                 |
| `npm run format` | Format with Prettier                             |

## Layout

```
apps/web/        Next.js 16: job inbox, filters and "Sync now"
packages/core/   Domain: Simplify schema, normalization, filters, cache
scripts/         setup-github.sh creates the labels and milestones with gh
docs/            Deployment and Google Sheet guides
.github/         CI, gitleaks scan, commit message check and templates
.husky/          Local hook that checks each commit message
```

## Data and privacy

- The Simplify repo doesn't declare a license. Uni doesn't redistribute its data: each instance downloads it directly.
- Your resume, your Sheet and your credentials must never be committed. `.gitignore` excludes `.env*`, `service-account*.json`, `*-credentials.json` and `resume*.pdf`, and gitleaks checks every pull request.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Commits follow Conventional Commits and are checked on your machine (husky) and in CI (commitlint). To report a security problem, see [SECURITY.md](SECURITY.md).

## Credits

Job data comes from [Simplify](https://simplify.jobs) and [Pitt CSC](https://github.com/SimplifyJobs/Summer2027-Internships).

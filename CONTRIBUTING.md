# Contributing to Uni

Thanks for helping. Uni has one design rule above the others: **each person runs their own instance, with their own keys and their own data.** Changes that need a central server won't be accepted. [PLAN.md](PLAN.md) explains why things are the way they are.

## Run the project

```bash
npm install
npm run dev   # http://127.0.0.1:3000
```

## How work happens

1. **Open an issue first**, for bugs and ideas alike, so we can agree before you write code.
2. Create a branch from `main`, named by area: `core/…`, `web/…`, `sheets/…`, `ai/…`, `infra/…`, `fix/…`, `docs/…`.
3. Write [Conventional Commits](https://www.conventionalcommits.org/) in small steps.
4. Open a pull request with `Closes #N`. It's merged with **Rebase and merge** once CI is green.

## Commits

Format: `type(scope): description`, in English and lowercase, describing what changes for the person using the app.

| Type       | For                                  |
| ---------- | ------------------------------------ |
| `feat`     | A new feature                        |
| `fix`      | A bug fix                            |
| `docs`     | Documentation only                   |
| `test`     | Tests only                           |
| `refactor` | An internal change, same behavior    |
| `style`    | Formatting, no logic change          |
| `chore`    | Configuration, dependencies, tooling |
| `ci`       | GitHub Actions                       |

Allowed scopes: `core`, `web`, `sheets`, `ai`, `infra`, `deps`. A change that doesn't belong to one area has no scope, for example `docs: contributing guide`.

Examples:

```
feat(web): a Sync now button that skips the weekly wait
fix(core): count "Arlington County, Arlington, VA" as a US location
ci: check commit messages on pull requests
```

A local hook (husky) checks the message when you commit, and CI checks every commit in the pull request.

## Checks

| What                            | Command                |
| ------------------------------- | ---------------------- |
| Everything (lint, types, tests) | `npm run check`        |
| Formatting                      | `npm run format:check` |
| Build                           | `npm run build`        |

## Adding a company policy

[`packages/core/src/companies/policies.json`](packages/core/src/companies/policies.json) lists companies whose internships international students can or can't apply to. The inbox hides roles from companies that rule them out, so every entry has to be backed by evidence.

- **Policy:** `accepts`, `no_sponsorship`, `us_person_required`, `citizenship_required` or `clearance_required`.
- **Source:** `posting` for entries in this list. Personal knowledge, such as what a recruiter told you, belongs in your own Google Sheet instead.
- **Evidence:** a short, verbatim quote from a current posting, its URL and the date you checked it (`YYYY-MM-DD`).
- **Note:** how many current postings you checked and how many say the same thing, for example "4 of 4 sampled Summer 2027 Software postings".
- **Aliases:** other names the company uses in Simplify, so the match doesn't miss them.

A policy applies to the whole company, so only add one when most of the company's current internships say the same thing. If a posting says something different, Simplify's flag for that role still wins.

`npm test` validates the file: an entry without evidence, with a bad date or with a duplicate name fails.

## Secrets and personal data

Never commit keys, passwords, a filled-in `.env`, your resume or data from your Sheet. gitleaks scans the full history in CI. Use made-up data in tests.

## Code of conduct

Taking part means following the [Code of Conduct](CODE_OF_CONDUCT.md).

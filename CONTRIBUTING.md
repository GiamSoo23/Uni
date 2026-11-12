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

## Secrets and personal data

Never commit keys, passwords, a filled-in `.env`, your resume or data from your Sheet. gitleaks scans the full history in CI. Use made-up data in tests.

## Code of conduct

Taking part means following the [Code of Conduct](CODE_OF_CONDUCT.md).

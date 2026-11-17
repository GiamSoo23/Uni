# Security

Uni runs on your own computer or in your own accounts. Its author runs no server and can't see your data.

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's
[private vulnerability report](https://github.com/GiamSoo23/Uni/security/advisories/new)
and include how to reproduce the problem. Uni is maintained by one person, so a reply may take a few days.

## A public repo doesn't give access to your app

- **The code is public, your keys aren't.** Locally they live in `apps/web/.env.local`; on Vercel, in the project's environment variables. `.gitignore` excludes them and gitleaks scans the full history on every pull request.
- **Online, only the owner gets in.** The Vercel project uses Vercel Authentication on **all** deployments, production included. Anyone who doesn't sign in with an account that has access to the project never reaches the app or "Sync now". See [docs/DEPLOY.md](docs/DEPLOY.md).
- **Locally, only your computer.** `npm run dev` and `npm start` listen on `127.0.0.1`, so nobody on the same Wi-Fi can open the app.
- **Forks don't get secrets.** GitHub Actions doesn't give the repo's secrets to pull requests from forks, and no workflow uses `pull_request_target`.

## Security model

| Asset                       | Where it lives                                  | How it's protected                                                     |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Simplify data               | `apps/web/.cache/`, or `/tmp` on Vercel         | Public data. Validated with Zod; links that aren't http(s) are dropped |
| The app online              | Vercel                                          | Vercel Authentication on all deployments                               |
| Claude key (M5)             | `.env.local` or Vercel environment variables    | Read only by the server. Never sent to the browser or written to logs  |
| Google service account (M3) | Environment variables, never a file in the repo | Only the `spreadsheets` scope, and only the Sheets you share with it   |
| Your resume and your Sheet  | Your computer and your Google account           | Never committed                                                        |

## Google service account

- **Credentials live only in environment variables:** `apps/web/.env.local` on your computer, which `.gitignore` excludes, and the Vercel project settings online. Uni reads them in server-only code and never sends them to the browser or writes them to logs.
- **Never commit a key file.** `.gitignore` excludes `service-account*.json` and `*-credentials.json` in every folder, and gitleaks scans every pull request. Delete the downloaded JSON once its two values are in `.env.local`.
- **One scope.** The service account requests only `https://www.googleapis.com/auth/spreadsheets`. It has no Drive, Gmail or project roles.
- **Only shared Sheets.** A service account can open only the spreadsheets explicitly shared with its email. Keep your Sheet's link sharing on "Restricted".

### If a key leaks

1. In the Google Cloud console, open **IAM & Admin → Service Accounts**, choose the account, then **Keys**, and **delete the leaked key**. It stops working at once.
2. **Create a new JSON key** for the same account (**Add key → Create new key → JSON**).
3. **Update `GOOGLE_PRIVATE_KEY`** in `apps/web/.env.local` and in the Vercel project settings, then restart the dev server and redeploy. Delete the new key file.
4. If the key reached a git commit, deleting the key is what protects you. Rewriting history doesn't remove copies others may have.

## Before spending money (M6)

- **A cap on Claude spending:** a monthly limit in the Anthropic Console, plus a maximum number of calls per sync inside the app.
- **A minimum wait between manual syncs**, as a second barrier behind the login.
- If the app ever has more than one user, it will need its own login with an allowlist of emails, checked in every server action.

## What's tested

- gitleaks scans the full git history on every pull request and every push to `main`.
- The `packages/core` tests cover validation of external data, including rejecting `javascript:` links.

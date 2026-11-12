# Private deployment on Vercel

Uni runs on Vercel (Hobby plan, free) and only the project owner can open it. **Vercel Authentication** provides the protection: anyone who doesn't sign in with a Vercel account that has access to the project sees a login screen and never reaches the app, or "Sync now".

Since September 2026, Vercel Authentication protects every deployment, production included, at no cost on every plan ([changelog](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan)).

## Steps (once)

1. Go to [vercel.com/signup](https://vercel.com/signup) and choose **Continue with GitHub**, using the account that owns the repo.
2. **Add New… → Project** and import `GiamSoo23/Uni`. If it isn't listed, give Vercel's GitHub App access to that repo.
3. In the import settings:
   - **Root Directory:** `apps/web`. Vercel detects Next.js and the npm workspaces, so it installs from the repo root and `@uni/core` is available.
   - No environment variables are needed. `UNI_SYNC_MAX_AGE_HOURS` is optional (default 168, one week).
4. **Deploy.**
5. **Before sharing the URL with anyone:** in the project, open **Settings → Deployment Protection → Vercel Authentication**, turn it on and choose **All Deployments**. Save.
6. Check in a private window that the production URL asks you to sign in.

## How it works on Vercel

- Every push to `main` deploys production, and every pull request gets a preview deployment, also protected.
- The copy of `listings.json` lives in `/tmp/uni-cache`, the only writable folder. It's lost when Vercel recycles the instance, and the next visit downloads it again (~13 MB, a few seconds).
- "Sync now" refreshes the instance that handles the request. If Vercel runs several instances, another one may show the previous copy until its own refresh.

## What this protection doesn't cover

- **The code** stays public on GitHub. That doesn't give access to the app or its environment variables.
- **Claude and Google keys** (later milestones) go in the project's **Settings → Environment Variables** on Vercel, never in the repo.
- If the app ever has more users, it will need its own login with an allowlist of emails. For a single user, Vercel Authentication is enough.

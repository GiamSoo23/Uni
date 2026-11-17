# Connecting your Google Sheet

Uni can read the Google Sheet where you track your applications. With it connected, the inbox hides roles you already applied to, and **Mark as applied** adds a row for you. Uni signs in as a Google Cloud service account that can open only the Sheets you share with it.

The Sheet is optional. Without it, the inbox still lists and filters every role. It just doesn't hide the ones you applied to or show the button.

## Before you start

You need a Google Sheet with an applications tab (named `Tracker` by default) whose first row has at least these columns: **Company**, **Role**, **Link**, **Date Applied**, **Status** and **Notes**. Other columns, such as App. #, Location, Industry or Resume Version, are filled in when present. Column order doesn't matter, and names are matched without regard to case.

Use a **personal Google account** to create the Google Cloud project. University and company accounts often belong to an organization that enforces the `iam.disableServiceAccountKeyCreation` policy, which blocks step 3. A project created with a personal account doesn't have that policy.

## Setup

1. **Create the service account.** In the [Google Cloud console](https://console.cloud.google.com/), create a project (or pick one of yours), then open **IAM & Admin → Service Accounts → Create service account**. Give it a name such as `uni-sheets`. It needs no project roles.
2. **Enable the Google Sheets API** in the same project: **APIs & Services → Library → Google Sheets API → Enable**.
3. **Create a JSON key.** Open the service account, then **Keys → Add key → Create new key → JSON**. The browser downloads a `.json` file.
4. **Copy two values from that file** into `apps/web/.env.local` (copy `.env.example` there first):
   - `client_email` goes into `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
   - `private_key` goes into `GOOGLE_PRIVATE_KEY`, on one line, as explained below.
5. **Delete the downloaded key file.** Empty the trash too. The key now lives only in `.env.local` (and in Vercel, see [DEPLOY.md](DEPLOY.md)). `.gitignore` excludes `service-account*.json` and `*-credentials.json`, but the safest key file is one that doesn't exist.
6. **Share the Sheet with the service account.** In the Sheet, press **Share**, paste the `client_email` address and choose **Editor**. Uni needs Editor to add and remove its own rows.
7. **Restrict link sharing.** In the same dialog, set **General access** to **Restricted**, so only the people and the service account you added can open the Sheet.

Then restart `npm run dev`. The configuration is read once per server process.

### The Sheet ID and the tab name

The Sheet ID is the part of the Sheet's URL between `/d/` and `/edit`:

```text
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abc/edit#gid=0
                                       └──────────── UNI_SHEET_ID ────────────┘
```

Set it as `UNI_SHEET_ID`. If your applications tab isn't called "Tracker", set `UNI_SHEET_TAB` to its name.

### The private key on one line

`GOOGLE_PRIVATE_KEY` may be stored on one line, with each newline written as the two characters `\n`. That is how `private_key` already appears in the JSON file, so you can paste it as is, without the surrounding quotes:

```bash
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n
```

Uni turns every `\n` back into a newline before it uses the key.

### All the variables

| Variable                       | Required | Default            | What it is                                   |
| ------------------------------ | -------- | ------------------ | -------------------------------------------- |
| `UNI_SHEET_ID`                 | Yes      |                    | The Sheet ID from its URL                    |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes      |                    | `client_email` from the key file             |
| `GOOGLE_PRIVATE_KEY`           | Yes      |                    | `private_key` from the key file, on one line |
| `UNI_RESUME_VERSION`           | No       | empty              | Written to the Resume Version column         |
| `UNI_TIME_ZONE`                | No       | `America/New_York` | Time zone used for the Date Applied column   |
| `UNI_SHEET_TAB`                | No       | `Tracker`          | Name of your applications tab                |

If any required variable is missing or invalid, the inbox shows "Google Sheet not connected" with the variable names, and never their values. An invalid optional variable falls back to its default.

## What Uni changes in your Sheet

**On the first Mark as applied**, Uni runs a one-time setup in the same write as the new row:

- It adds a **Job ID** column to the right of your last header. Uni uses it to recognize its own rows.
- It creates a **Companies** tab with the columns described below.

It never renames, moves or deletes your columns, rows or other tabs.

**Each Mark as applied** inserts one row right below your last non-empty row. Status is `Submitted`, Date Applied is today (for example `Nov 17, 2026`), and Notes names the application system when Uni recognizes the link, such as `Greenhouse. Found on the Simplify Summer 2027 GitHub list.` Industry is copied from your latest row for the same company. Values that start with `=`, `+`, `-` or `@` are stored as text, never as formulas.

**Undo** shows for 10 seconds after Mark as applied. It deletes the row Uni just added, found by its Job ID. If more than one row has that Job ID, Undo deletes nothing and tells you.

Reading the Sheet to render the inbox never writes to it. Uni keeps what it read for 60 seconds, and **Sync now** reads it again.

### Hiding roles you applied to

A role counts as applied when a row matches it by Job ID, by link or by company and role, and that row's Status is anything other than empty, `No role` or `Not started`.

The **Applied** filter controls what happens to those roles. It maps to the `applied` URL parameter:

- `applied=hide` (the default) hides them and says how many were hidden.
- `applied=show` keeps them, with their Status as a badge.

### The Companies tab

Rows in the Companies tab override Uni's public company list. Use it for what you learned yourself, for example from a recruiter.

| Column       | Required | Accepted values                                                                                   |
| ------------ | -------- | ------------------------------------------------------------------------------------------------- |
| Company      | Yes      | The company name as Simplify shows it                                                             |
| Policy       | Yes      | `accepts`, `no_sponsorship`, `us_person_required`, `citizenship_required` or `clearance_required` |
| Scope        | No       | What the policy applies to, such as "Internships"                                                 |
| Note         | Yes      | 10 to 300 characters: where the answer comes from                                                 |
| Evidence URL | No       | An http(s) link to the source                                                                     |
| Checked      | Yes      | The date you checked, as `YYYY-MM-DD`, for example `2026-11-12`                                   |

Policy is read without regard to case, and spaces count as underscores, so "No Sponsorship" works. Roles decided by your Sheet show **· your Sheet** next to their eligibility. Invalid rows are skipped, and the inbox lists their row numbers. When a company appears twice, the lower row wins.

## When something fails

The inbox keeps working when Google fails. It shows the list from the last successful read, with its time, or the full list without your Sheet. The message names one of these categories:

| Category            | Common causes                                                                                  | What to do                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permission_denied` | The Sheet isn't shared with the service account, the key was deleted, or the Sheets API is off | Share the Sheet with the email shown in the message as Editor. Check that the key still exists and that the Google Sheets API is enabled.            |
| `not_found`         | `UNI_SHEET_ID` is wrong, or the Sheet was deleted                                              | Copy the ID again from the Sheet's URL and restart the server.                                                                                       |
| `rate_limited`      | Too many requests to Google in the last minute                                                 | Wait a minute and reload. Uni already retries three times.                                                                                           |
| `network`           | No connection, a 10-second timeout, or a Google server error                                   | Check your connection and try again. After a timed-out Mark as applied, press it again: Uni finds the row if it was written and doesn't add another. |
| `invalid_sheet`     | The applications tab was renamed, a required column is missing, or a value is too long         | Rename the tab back or set `UNI_SHEET_TAB`. Add the columns the message names.                                                                       |

The server log records the category, the HTTP status and Google's reason. It never records the key, tokens or cell contents.

## Checking against your real Sheet

`apps/web/scripts/sheets-e2e.ts` runs Mark as applied and Undo against your real Sheet with a disposable test role ("UNI E2E TEST", with a Role that starts with `=1+1`). It checks that the row lands right below your last row, reads as text, and disappears after Undo, and that no other row changed. If a check fails after the insert, it still deletes its test row.

It writes to your Sheet, so it only runs when you ask for it twice:

```bash
cd apps/web
UNI_E2E=1 node --conditions=react-server --import tsx scripts/sheets-e2e.ts --confirm
```

It reads `apps/web/.env.local`. If the Sheet had no Job ID column or Companies tab yet, this run adds them, and they stay. Afterwards, open **File → Version history** in the Sheet to confirm what changed.

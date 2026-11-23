# Changelog

Notable changes to Uni. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- A job inbox with the open roles from the Simplify repo, each with a direct link to apply.
- Filters for term, category, region, posting date, text and eligibility.
- A weekly sync with a local cache and ETag, and a "Sync now" button.
- If GitHub fails, the app keeps showing the last good copy.
- Vercel deployment: the cache uses `/tmp` and Node is pinned to 24.x. Guide in `docs/DEPLOY.md`.
- A fishing hook favicon, also shown next to the name.
- Company eligibility policies: a sourced list of companies whose internships rule out international students. The inbox hides their roles, says how many it hid, and links each label to its evidence.
- Google Sheet sync through a service account. The inbox hides roles already in your Sheet, with an **Applied** filter to show them with their Status. Guide in `docs/SHEETS.md`.
- **Mark as applied** adds a row in your format right below your last row, and **Undo** removes it for 10 seconds.
- A **Companies** tab in your Sheet overrides the public company list.
- If Google fails, the inbox keeps working with the last good read of your Sheet, and names what failed.
- Uni reads each posting's description on Greenhouse, Lever, Ashby and Workday, and hides roles that require U.S. citizenship, U.S. person status or a security clearance, or that rule out visa sponsorship. The label says "· posting" and quotes the sentence.
- When a job board refuses Uni's requests, as Workday does from Vercel, the summary says how many postings on it couldn't be read.

### Changed

- All documentation, the interface and the GitHub metadata are in English.
- "Sponsorship not stated" is now "Eligibility not verified", because silence from Simplify doesn't mean a role accepts international students.

### Security

- Online, Vercel Authentication protects every deployment: only the owner gets in.
- Locally, the app only listens on `127.0.0.1`.
- gitleaks scans the full history on every pull request.
- The Sheet's service account asks only for the spreadsheets scope. Values starting with `=`, `+`, `-` or `@` are written as text, never as formulas.

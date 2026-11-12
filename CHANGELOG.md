# Changelog

Notable changes to Uni. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- A job inbox with the open roles from the Simplify repo, each with a direct link to apply.
- Filters for term, category, region, posting date, text and eligibility.
- A weekly sync with a local cache and ETag, and a "Sync now" button.
- If GitHub fails, the app keeps showing the last good copy.
- Vercel deployment: the cache uses `/tmp` and Node is pinned to 24.x. Guide in `docs/DEPLOY.md`.

### Changed

- All documentation, the interface and the GitHub metadata are in English.

### Security

- Online, Vercel Authentication protects every deployment: only the owner gets in.
- Locally, the app only listens on `127.0.0.1`.
- gitleaks scans the full history on every pull request.

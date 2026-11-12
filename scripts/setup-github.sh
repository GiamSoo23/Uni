#!/usr/bin/env bash
# Creates the project's labels and milestones in the current GitHub repo.
# Needs `gh auth login`. Safe to run again: it updates whatever already exists.
set -euo pipefail

label() { gh label create "$1" --color "$2" --description "$3" --force; }

label "type:feature" "1d76db" "A new feature"
label "type:bug" "d73a4a" "Something doesn't work"
label "type:chore" "cfd3d7" "Maintenance, dependencies, configuration"
label "type:docs" "0075ca" "Documentation"
label "type:test" "bfdadc" "Tests"

label "area:core" "5319e7" "packages/core: domain, sources and filters"
label "area:web" "0e8a16" "apps/web: the Next.js interface"
label "area:sheets" "fbca04" "Google Sheets sync"
label "area:ai" "c5def5" "Claude integration"
label "area:infra" "006b75" "AWS, CDK and deployment"
label "area:ci" "ededed" "GitHub Actions and quality gates"
label "area:docs" "0052cc" "README, PLAN and guides"
label "security" "b60205" "Security or privacy"

label "priority:high" "b60205" "Blocks daily use"
label "priority:medium" "d93f0b" "Important, not urgent"
label "priority:low" "c2e0c6" "When there's time"

milestone() {
  local title="$1" description="$2" number
  number=$(gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" \
    --jq ".[] | select(.title == \"$title\") | .number")
  if [[ -n "$number" ]]; then
    gh api -X PATCH "repos/{owner}/{repo}/milestones/$number" -f description="$description" >/dev/null
    echo "Milestone updated: $title"
  else
    gh api "repos/{owner}/{repo}/milestones" -f title="$title" -f description="$description" >/dev/null
    echo "Milestone created: $title"
  fi
}

milestone "M0 · Foundation and quality gates" "Monorepo, strict TypeScript, lint, tests, gitleaks, Conventional Commits and CI on every PR."
milestone "M1 · Simplify source and job inbox" "Download Simplify's listings with a cache, filter them and show them in a web inbox with Sync now."
milestone "M2 · Private deployment" "The inbox runs on Vercel and only the owner can open it (Vercel Authentication on all deployments)."
milestone "M3 · Google Sheets" "A service account, reading hyperlinks, and Mark as applied."
milestone "M4 · Full inbox" "Not interested, matching against the Sheet, and per-role states."
milestone "M5 · Profile from the resume" "Resume PDF to a profile with Claude, eligibility questions, your own key."
milestone "M6 · Evaluation with Claude" "Descriptions per ATS, sponsorship with a quote, and a fit score."
milestone "M7 · Company signals" "Sponsorship notes from the Sheet and USCIS H-1B data."
milestone "M8 · Companies and career portals" "Top 100-150 companies, a Companies tab, and watching NO ROLE companies."
milestone "M9 · AWS" "CDK, a weekly Scheduler, Lambda, SQS, DLQ, Budgets and OIDC."
milestone "M10 · Alerts" "A weekly digest through a webhook."
milestone "M11 · Open source v0.1" "ARCHITECTURE.md, a setup guide for other people, and the first release."

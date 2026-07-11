# CLI

Use the published package directly:

```bash
npx freelane-ci@latest --help
```

## Setup

```bash
npx freelane-ci@latest init
npx freelane-ci@latest config validate
npx freelane-ci@latest plan
npx freelane-ci@latest setup github-actions --workflow .github/workflows/ci.yml
npx freelane-ci@latest migrate github-actions --workflow .github/workflows/ci.yml
npx freelane-ci@latest init github-actions
```

`setup github-actions` is the one-command path for an existing repository that
does not have `.freelane.yml` yet. Repeat `--workflow` to migrate several files.
It discovers jobs, creates a GitHub-credits-first config with Blacksmith next,
and updates the workflows. Repeat `--provider` to set provider order explicitly.
Use `--github-plan public|free|pro|team|enterprise` for normal onboarding, or
`--github-minutes N` to record a custom included allowance.

`migrate github-actions` updates an existing workflow. It adds one `freelane`
router job, keeps the existing job steps, and changes matched `runs-on` values
to `needs.freelane.outputs.<job_alias>`.

Useful flags:

```bash
npx freelane-ci@latest migrate github-actions --workflow .github/workflows/ci.yml --dry-run
npx freelane-ci@latest migrate github-actions --workflow .github/workflows/ci.yml --job-map check=test-linux
npx freelane-ci@latest init github-actions --force
npx freelane-ci@latest init github-actions --config ci/freelane.yml
npx freelane-ci@latest init github-actions --uses thoughts-on-things/freelane-ci@v0
```

`init github-actions` is for new workflows. It reads `.freelane.yml` and writes
`.github/workflows/freelane-ci.yml` with a `freelane` router job, friendly output
aliases, and starter downstream jobs.

## Routing

```bash
npx freelane-ci@latest resolve --job test-linux
npx freelane-ci@latest resolve --job test-linux --format json
npx freelane-ci@latest providers doctor
```

## Usage State

```bash
npx freelane-ci@latest usage report
npx freelane-ci@latest usage sync-github --repo owner/repo
```

Routing commands automatically read `.freelane-usage.json` when it exists. Pass
`--no-usage-state` to ignore it.

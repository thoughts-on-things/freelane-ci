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
npx freelane-ci@latest init github-actions
```

`init github-actions` reads `.freelane.yml` and writes
`.github/workflows/freelane-ci.yml`. It creates a `freelane` router job, one
friendly output alias per configured job, and starter downstream jobs.

Useful flags:

```bash
npx freelane-ci@latest init github-actions --force
npx freelane-ci@latest init github-actions --config ci/freelane.yml
npx freelane-ci@latest init github-actions --uses thoughts-on-things/freelane-ci@v0
```

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

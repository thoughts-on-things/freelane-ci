# Getting Started

## Set Up An Existing Repository

Install the Blacksmith GitHub integration for your organization at
[app.blacksmith.sh](https://app.blacksmith.sh), then run:

```bash
npx freelane-ci@latest setup github-actions \
  --workflow .github/workflows/ci.yml \
  --workflow .github/workflows/launcher-ci.yml
```

The command discovers literal GitHub and Blacksmith runner labels, writes
`.freelane.yml`, and migrates every listed workflow. Configured GitHub credits
are used first, followed by Blacksmith's 3,000 normalized free minutes;
GitHub remains the default fallback. Provider order and fallback policy can both
be changed in `.freelane.yml`.
Existing job steps, conditions, matrices, permissions, and dependencies are
preserved. Dynamic `runs-on` expressions and unknown runner labels are reported
as skipped. Runtime estimates are learned from completed Actions jobs; no
duration guesses are written to `.freelane.yml`.

Provider order can be explicit:

```bash
npx freelane-ci@latest setup github-actions --workflow .github/workflows/ci.yml \
  --provider github --provider blacksmith --github-plan team
```

Use `--provider github` for a GitHub-only config. Setup will not replace an
existing config unless `--force` is supplied; use `migrate github-actions` when
the repository is already configured. GitHub's included minutes vary by private
repository plan, so setup defaults them to zero. Use `--github-plan` with
`public`, `free`, `pro`, `team`, or `enterprise`, or pass an exact allowance
with `--github-minutes`.

## Create A Config For A New Repository

```bash
npx freelane-ci@latest init
```

Edit `.freelane.yml` to enable the providers you use and define the jobs you
want Freelane to route.

Validate it:

```bash
npx freelane-ci@latest config validate
```

## Preview Routing

```bash
npx freelane-ci@latest plan
```

Check configured provider routing:

```bash
npx freelane-ci@latest providers doctor
```

Resolve one job when debugging:

```bash
npx freelane-ci@latest resolve --job test-linux --format json
```

Routing commands automatically read `.freelane-usage.json` when it exists. Use
`--no-usage-state` to ignore it.

## Migrate A Workflow

```bash
npx freelane-ci@latest migrate github-actions --workflow .github/workflows/ci.yml
```

Freelane must run before the job it routes because GitHub chooses a runner before
job steps execute. The migration keeps your existing jobs, adds a `freelane`
router job, and changes matched `runs-on` values to router outputs.

```yaml
jobs:
  freelane:
    runs-on: ubuntu-latest
    outputs:
      test_linux: ${{ steps.route.outputs.test_linux }}
    steps:
      - uses: actions/checkout@v7
      - id: route
        uses: thoughts-on-things/freelane-ci@v0
        with:
          jobs: '[{"job":"test-linux","alias":"test_linux"}]'
          token: ${{ github.token }}
          repository: ${{ github.repository }}

  test:
    needs: freelane
    runs-on: ${{ needs.freelane.outputs.test_linux }}
    steps:
      - uses: actions/checkout@v7
      - run: npm test
```

If a workflow job name differs from the Freelane job key, map it explicitly:

```bash
npx freelane-ci@latest migrate github-actions --workflow .github/workflows/ci.yml --job-map check=test-linux
```

Use `init github-actions` when starting a new workflow from scratch:

```bash
npx freelane-ci@latest init github-actions
```

The CLI automatically uses the JSON runner output when a job resolves to an
array-style runner.

The router reads recent completed job history with the workflow's `actions: read`
permission. It learns P75 duration by job name or platform, applies observed
provider usage, and reserves predicted quota across every routed job in one
plan. A manual `estimate_minutes` remains available as an override. If history
cannot be read, routing continues with configured state and emits a warning.

The action logs each selected job, provider, runner, quota burn, and reason. It
also writes the workflow plan to the GitHub job summary.

See [examples/github-actions/freelane-routed.yml](../examples/github-actions/freelane-routed.yml).

## Usage State

Report configured quota state:

```bash
npx freelane-ci@latest usage report
```

Sync recent GitHub Actions history into local state:

```bash
GITHUB_TOKEN=... npx freelane-ci@latest usage sync-github --repo owner/repo
```

In GitHub Actions, grant the job `actions: read` and pass `${{ github.token }}`.
See [examples/github-actions/freelane-usage-sync.yml](../examples/github-actions/freelane-usage-sync.yml).

The action validates config by default. Set `validate: false` only when testing
future config fields locally.

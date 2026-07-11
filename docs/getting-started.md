# Getting Started

## Create A Config

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
      test_linux: ${{ steps.test_linux.outputs.label }}
      test_linux_runs_on: ${{ steps.test_linux.outputs.runs_on }}
    steps:
      - uses: actions/checkout@v7
      - id: test_linux
        uses: thoughts-on-things/freelane-ci@v0
        with:
          job: test-linux

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

The action logs the selected job, provider, runner, quota burn, remaining quota,
and reason. It also writes the same route decision to the GitHub job summary.

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

# Freelane CI

Freelane CI routes GitHub Actions jobs across runner providers so teams can use
free credits first and switch providers with one config change.

Status: early OSS starter. The CLI and action resolve configured providers; live
provider usage APIs are still on the roadmap.

## Why

CI credits are scattered across GitHub, Blacksmith, Ubicloud, WarpBuild,
Namespace, and other services. Freelane gives teams one small routing layer:

- declare providers and fallback rules
- resolve a job to a `runs-on` label
- keep workflows close to normal GitHub Actions

## Quick Start

For an existing GitHub Actions repository, setup can discover jobs, create the
config, and migrate one or more workflows in one command:

```bash
npx freelane-ci@latest setup github-actions \
  --workflow .github/workflows/ci.yml \
  --workflow .github/workflows/release.yml
```

This defaults to configured GitHub credits first, then Blacksmith (including its
3,000 normalized free minutes). GitHub remains the default fallback; all
provider order and fallback choices stay configurable. Before running the migrated workflows, authorize
the GitHub organization at [app.blacksmith.sh](https://app.blacksmith.sh).
Blacksmith currently supports organization-owned repositories, not personal
repositories. Use `--provider github` for GitHub-only setup, or repeat
`--provider` to choose the order explicitly. For a private repository, pass its
plan with `--github-plan free|pro|team|enterprise`, or use `--github-minutes` for
an exact allowance. Setup defaults conservatively to zero. Use
`--github-plan public` for unlimited standard GitHub-hosted runners in a public
repository.

Setup preserves job steps and metadata. It reports jobs with dynamic or unknown
`runs-on` values as skipped so they can be handled deliberately.

For a new workflow, create a config first:

```bash
npx freelane-ci@latest init
```

Edit `.freelane.yml`:

```yaml
version: 1

providers:
  github:
    enabled: true
  blacksmith:
    enabled: true
    free_minutes_per_month: 3000
  ubicloud:
    enabled: true
    free_credit_usd_per_month: 2

jobs:
  test-linux:
    os: linux
    arch: x64
    min_vcpu: 2
    estimate_minutes: 8
    providers: [github, blacksmith, ubicloud]
```

Preview the route and generate a starter workflow:

```bash
npx freelane-ci@latest config validate
npx freelane-ci@latest plan
npx freelane-ci@latest init github-actions
```

Migrating an existing workflow is usually better:

```bash
npx freelane-ci@latest migrate github-actions --workflow .github/workflows/ci.yml
```

Use `--job-map check=test-linux` when a workflow job name differs from the
Freelane job key. The migration adds one `freelane` router job and updates
matched jobs to use friendly outputs:

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

The CLI automatically uses the JSON runner output when a job resolves to an
array-style runner.

Try the CLI locally:

```bash
npx freelane-ci@latest providers list
npx freelane-ci@latest config validate --config examples/freelane.yml
npx freelane-ci@latest usage report --config examples/freelane.yml
npx freelane-ci@latest plan --config examples/freelane.yml
npx freelane-ci@latest resolve --config examples/freelane.yml --job test-linux --format json
npx freelane-ci@latest providers doctor --config examples/freelane.yml
```

## Initial Providers

- `github`
- `blacksmith`
- `ubicloud`
- `warpbuild`
- `namespace`

External CI systems such as CircleCI, GitLab CI, Azure Pipelines, and Travis CI
are later adapters because they require remote pipeline orchestration.

## Docs

- [Installation](docs/installation.md)
- [Getting started](docs/getting-started.md)
- [CLI](docs/cli.md)
- [Configuration](docs/configuration.md)
- [Providers](docs/providers.md)
- [Security model](docs/security-model.md)
- [Roadmap](docs/roadmap.md)
- [Releasing](docs/releasing.md)

## Development

```bash
npm install
npm run check
```

## License

MIT. See [LICENSE](LICENSE).

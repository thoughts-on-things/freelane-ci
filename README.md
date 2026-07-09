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

Create a config:

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
    providers: [blacksmith, ubicloud, github]
```

Preview the route and generate a starter workflow:

```bash
npx freelane-ci@latest config validate
npx freelane-ci@latest plan
npx freelane-ci@latest init github-actions
```

The generated workflow creates one `freelane` router job and friendly outputs for
each configured job:

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

Use `runs-on: ${{ fromJSON(needs.freelane.outputs.test_linux_runs_on) }}` only
when a job may resolve to an array-style runner.

Try the CLI locally:

```bash
npx freelane-ci@latest providers list
npx freelane-ci@latest config validate --config examples/freelane.yml
npx freelane-ci@latest usage report --config examples/freelane.yml
npx freelane-ci@latest usage sync-github --repo owner/repo
npx freelane-ci@latest plan --config examples/freelane.yml
npx freelane-ci@latest resolve --config examples/freelane.yml --job test-linux --format json
npx freelane-ci@latest providers doctor --config examples/freelane.yml
```

For scheduled usage sync in GitHub Actions, see
[examples/github-actions/freelane-usage-sync.yml](examples/github-actions/freelane-usage-sync.yml).

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
- [Research](docs/research/2026-07-08-ci-provider-landscape.md)
- [Architecture](docs/architecture/mvp-routing.md)

## Development

```bash
npm install
npm run check
```

## License

MIT. See [LICENSE](LICENSE).

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

Create `.freelane.yml`:

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

Use the router job output in `runs-on`:

```yaml
jobs:
  freelane:
    runs-on: ubuntu-latest
    outputs:
      runs_on: ${{ steps.route.outputs.runs_on }}
    steps:
      - uses: actions/checkout@v4
      - id: route
        uses: freelane-ci/freelane/action@v0
        with:
          job: test-linux
          validate: true

  test:
    needs: freelane
    runs-on: ${{ fromJSON(needs.freelane.outputs.runs_on) }}
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

Try the CLI locally:

```bash
npm install
npm run build
node dist/cli.js init --output .freelane.yml
node dist/cli.js providers list
node dist/cli.js config validate --config examples/freelane.yml
node dist/cli.js usage report --config examples/freelane.yml
node dist/cli.js usage sync-github --repo owner/repo
node dist/cli.js plan --config examples/freelane.yml
node dist/cli.js resolve --config examples/freelane.yml --job test-linux --format json
node dist/cli.js providers doctor --config examples/freelane.yml
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

- [Getting started](docs/getting-started.md)
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

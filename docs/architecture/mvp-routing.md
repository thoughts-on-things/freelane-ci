# MVP Routing Architecture

## Goal

Make provider switching and free-credit optimization easy for GitHub Actions
users without asking them to rebuild their CI around a new system.

## Core Pattern

Freelane runs in a small router job and emits the runner label for downstream
jobs:

```yaml
jobs:
  freelane:
    runs-on: ubuntu-latest
    outputs:
      runs_on: ${{ steps.route.outputs.runs_on }}
    steps:
      - id: route
        uses: freelane-ci/freelane/action@v0
        with:
          job: test-linux

  test:
    needs: freelane
    runs-on: ${{ fromJSON(needs.freelane.outputs.runs_on) }}
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

`runs_on` is JSON so providers can return either:

```json
"ubuntu-latest"
```

or:

```json
["nscloud-ubuntu-24.04-amd64-4x8-with-cache", "nscloud-cache-tag-main"]
```

## Components

### Action Wrapper

Thin GitHub Action entrypoint that:

- reads `.freelane.yml`
- resolves the requested job key
- prints a human-readable decision summary
- sets outputs for `runs_on`, `provider`, `reason`, and `alerts`

### CLI Core

The action should call a CLI so users can also run:

```bash
freelane resolve --job test-linux --format github-output
freelane providers doctor
freelane usage report
```

### Config Parser

Loads user intent:

- provider order
- per-provider credentials
- monthly free credits or minutes
- fallback policy
- alerts
- runner requirements per job
- paid usage policy

### Provider Adapters

Each adapter implements:

```text
id
capabilities()
quota()
usage()
health()
runner_options(job)
estimate(job, runner)
```

Adapter quality levels:

- `native`: provider exposes documented usage/quota APIs
- `inferred`: Freelane estimates usage from GitHub workflow job history
- `configured`: user supplies quota and Freelane tracks/estimates locally
- `manual`: provider is selectable but cannot be quota-optimized yet

### Decision Engine

Inputs:

- job requirements
- provider capabilities
- remaining free quota
- estimated duration
- estimated provider-specific unit cost
- queue health
- user priority rules

Output:

- selected provider
- selected `runs-on` JSON
- reason
- warnings
- fallback candidates

### Usage Collector

MVP should rely on GitHub workflow history first because every runner-compatible
provider still executes inside GitHub Actions.

Data to collect:

- workflow name
- job name
- conclusion
- start and end time
- runner name/group/labels when exposed
- selected provider metadata emitted by Freelane

Later, provider-native APIs can replace or augment inference.

### Alerts

MVP alerts:

- GitHub workflow warnings
- step summary table
- optional webhook URL

Later alerts:

- Slack
- issue creation
- pull request comments
- repository or organization variables updated with current budget state

## Decision Algorithm

1. Load config and job request.
2. Expand provider aliases and runner options.
3. Filter providers that cannot satisfy hard requirements.
4. Fetch quota, usage, and health with adapter-specific confidence.
5. Estimate job duration from previous runs or config defaults.
6. Estimate free-credit burn for each option.
7. Apply policy:
   - avoid paid usage unless allowed
   - preserve configured reserves
   - prefer providers with expiring/free quota
   - prefer lower queue risk
   - prefer user-specified provider order as a tie breaker
8. Emit `runs_on` and a decision summary.

## Example Config

```yaml
version: 1

defaults:
  paid: avoid
  reserve:
    github: 100
    blacksmith: 200
  fallback:
    mode: pre_schedule
    providers: [github]

providers:
  github:
    enabled: true
    owner: my-org
    scope: org

  blacksmith:
    enabled: true
    free_minutes_per_month: 3000

  ubicloud:
    enabled: true
    free_credit_usd_per_month: 2

  warpbuild:
    enabled: true
    free_credit_usd_per_month: 10

  namespace:
    enabled: false
    unit_minutes_per_month: 100000

jobs:
  test-linux:
    os: linux
    arch: x64
    min_vcpu: 2
    estimate_minutes: 8
    providers:
      - blacksmith
      - ubicloud
      - warpbuild
      - github

  test-macos:
    os: macos
    arch: arm64
    min_vcpu: 6
    estimate_minutes: 12
    providers:
      - blacksmith
      - warpbuild
      - namespace
      - github
```

## Provider Adapter Notes

### GitHub

Use official billing, workflow, and self-hosted runner APIs. For public repos,
standard GitHub-hosted runners are free and should usually be the default unless
the user values speed/capabilities over unlimited free usage.

### Blacksmith

Route through labels such as `blacksmith-2vcpu-ubuntu-2404`. Use configured
monthly free minutes and infer usage from GitHub job history until a stable
public billing API is documented.

### Ubicloud

Route through labels such as `ubicloud-standard-2`. Model the `$2/month` credit
and provider pricing. Infer usage from GitHub job history and provider labels.

### WarpBuild

Route through labels such as `warp-ubuntu-latest-x64-2x`. Use API keys for
available automation endpoints. Support CSV report import or future API usage
sync for billing reports.

### Namespace

Route through profiles or direct labels. Because labels can be arrays and only
one `nscloud` machine label is allowed, the adapter must validate label output
carefully.

## Non-Goals For MVP

- Creating accounts with CI providers.
- Farming free trials or bypassing provider limits.
- Remote-pipeline orchestration for CircleCI, GitLab CI, Azure Pipelines, or
  Travis CI.
- Guaranteed fallback after a job is already queued on an unavailable runner.

## Open Questions

- Which runtime should we choose for the CLI and action: TypeScript, Go, or
  Python?
- Should decision state be entirely inferred from GitHub history, or should we
  maintain a small state artifact/cache?
- Should we eventually ship a GitHub App for better permissions, monitoring,
  stuck-job rescue, and organization-level rollout?
- How much provider-specific pricing should be hardcoded versus loaded from a
  versioned registry file?

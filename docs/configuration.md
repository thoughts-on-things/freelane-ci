# Configuration

Freelane reads `.freelane.yml` by default.

```yaml
$schema: https://raw.githubusercontent.com/thoughts-on-things/freelane-ci/main/schemas/freelane.schema.json
version: 1

defaults:
  paid: avoid
  reserve:
    blacksmith: 200
  fallback:
    mode: pre_schedule
    providers: [github]

providers:
  github:
    enabled: true
  blacksmith:
    enabled: true
    free_minutes_per_month: 3000

jobs:
  test-linux:
    os: linux
    arch: x64
    min_vcpu: 2
    estimate_minutes: 8
    providers: [blacksmith, github]
```

## Defaults

`paid` controls behavior when configured free quota is unavailable:

- `avoid`: prefer free quota, but allow fallback if needed
- `allow`: allow paid usage
- `forbid`: fail when free quota is unavailable

`reserve` keeps provider quota unused. The value uses the provider's configured
quota unit: minutes, dollars, or unit minutes.

## Providers

Provider quota fields:

- `free_minutes_per_month`
- `free_credit_usd_per_month`
- `unit_minutes_per_month`

Optional local usage fields:

- `used_minutes`
- `used_credit_usd`
- `used_unit_minutes`

`freelane usage sync-github` can also write `.freelane-usage.json`; routing
commands read it automatically when present.

Use `runner` to override Freelane's built-in runner label:

```yaml
providers:
  blacksmith:
    enabled: true
    runner: blacksmith-4vcpu-ubuntu-2404
```

## Jobs

Required:

- `os`: `linux`, `windows`, or `macos`

Optional:

- `arch`: `x64` or `arm64`
- `min_vcpu`
- `estimate_minutes`
- `providers`
- `runner`

`runner` on a job bypasses provider routing.

## Schema

The JSON Schema lives at [schemas/freelane.schema.json](../schemas/freelane.schema.json).
Published configs can use the remote schema URL from `freelane init`.

Validate a config:

```bash
freelane config validate --config .freelane.yml
```

Validation checks both schema shape and provider references in jobs, reserves,
and fallbacks.

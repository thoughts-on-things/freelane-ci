# Providers

Freelane's first provider model is GitHub Actions compatible runner labels.
Built-in labels follow each provider's public runner documentation.

List supported adapters:

```bash
freelane providers list
```

## GitHub

Default labels:

- `ubuntu-latest`
- `ubuntu-24.04-arm`
- `windows-latest`
- `macos-latest`

Source: [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

## Blacksmith

Generated labels include:

- `blacksmith-2vcpu-ubuntu-2404`
- `blacksmith-4vcpu-ubuntu-2404-arm`
- `blacksmith-4vcpu-windows-2025`
- `blacksmith-6vcpu-macos-15`

Source: [Blacksmith instance types](https://docs.blacksmith.sh/blacksmith-runners/overview)

Blacksmith's 3,000-minute free tier is measured in normalized x64 2-vCPU
minutes. Freelane applies Blacksmith's documented ratios when planning and when
syncing usage: ARM is 0.625x and Windows is 2x before vCPU scaling; a 6-vCPU
macOS minute consumes 20 normalized minutes.

## Ubicloud

Generated labels include:

- `ubicloud-standard-2`
- `ubicloud-standard-8`
- `ubicloud-standard-4-arm`

Ubicloud is Linux-only in the current adapter.

Source: [Ubicloud runner types](https://www.ubicloud.com/docs/github-actions-integration/runner-types)

## WarpBuild

Generated labels include:

- `warp-ubuntu-latest-x64-2x`
- `warp-ubuntu-latest-arm64-4x`
- `warp-windows-latest-x64-4x`
- `warp-macos-latest-arm64-6x`

Source: [WarpBuild cloud runners](https://www.warpbuild.com/docs/ci/cloud-runners)

## Namespace

Generated labels include:

- `nscloud-ubuntu-24.04-amd64-4x8`
- `nscloud-ubuntu-24.04-arm64-4x8`
- `nscloud-windows-2022-amd64-4x8`
- `nscloud-macos-sequoia-arm64-6x14`

Source: [Namespace runner configuration](https://namespace.so/docs/reference/github-actions/runner-configuration)

You can also use a profile:

```yaml
providers:
  namespace:
    enabled: true
    profile: default
```

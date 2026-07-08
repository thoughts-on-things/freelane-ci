# Providers

Freelane's first provider model is GitHub Actions compatible runner labels.

## GitHub

Default labels:

- `ubuntu-latest`
- `ubuntu-24.04-arm`
- `windows-latest`
- `macos-latest`

## Blacksmith

Generated labels include:

- `blacksmith-2vcpu-ubuntu-2404`
- `blacksmith-4vcpu-ubuntu-2404-arm`
- `blacksmith-4vcpu-windows-2025`
- `blacksmith-6vcpu-macos-15`

## Ubicloud

Generated labels include:

- `ubicloud-standard-2`
- `ubicloud-standard-8`
- `ubicloud-standard-4-arm`

Ubicloud is Linux-only in the current adapter.

## WarpBuild

Generated labels include:

- `warp-ubuntu-latest-x64-2x`
- `warp-ubuntu-latest-arm64-4x`
- `warp-windows-latest-x64-4x`
- `warp-macos-latest-arm64-6x`

## Namespace

Generated labels include:

- `nscloud-ubuntu-24.04-amd64-4x8`
- `nscloud-ubuntu-24.04-arm64-4x8`
- `nscloud-windows-2022-amd64-4x8`
- `nscloud-macos-sequoia-arm64-6x12`

You can also use a profile:

```yaml
providers:
  namespace:
    enabled: true
    profile: default
```

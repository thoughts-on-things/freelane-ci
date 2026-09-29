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

Standard runners are free in public repositories. Private repositories include
2,000 minutes per month on Free, 3,000 on Pro and Team, and 50,000 on
Enterprise Cloud; `setup --github-plan` uses these values. Overage is billed
per minute by SKU, for example $0.006 for Linux 2-core x64. GitHub's docs no
longer publish minute multipliers, so Freelane still uses the last documented
values against the included quota: 2x for Windows and 10x for macOS.

Sources: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

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

When Blacksmith is configured with `free_credit_usd_per_month`, Freelane uses
$0.004 per minute for 2-vCPU Linux x64, $0.0025 for ARM, $0.008 for Windows,
and $0.08 for 6-vCPU macOS. Larger runners scale linearly by vCPU.

Source: [Blacksmith pricing](https://www.blacksmith.sh/pricing)

## Ubicloud

Generated labels include:

- `ubicloud-standard-2`
- `ubicloud-standard-8`
- `ubicloud-standard-4-arm`

Ubicloud is Linux-only in the current adapter.

Ubicloud includes $2.50 of free credit per month. Standard runners cost
$0.00125 per minute per 2 vCPU on both x64 and ARM (effective 2026-09-01).
Premium runners cost $0.002 per minute per 2 vCPU and are enabled by default
for new accounts. If premium is enabled, Freelane's burn estimates for Ubicloud
are 1.6x too low; disable premium or lower `free_credit_usd_per_month`
accordingly.

Sources: [Ubicloud runner types](https://www.ubicloud.com/docs/github-actions-integration/runner-types),
[Ubicloud pricing](https://www.ubicloud.com/docs/about/pricing)

## WarpBuild

Generated labels include:

- `warp-ubuntu-latest-x64-2x`
- `warp-ubuntu-latest-arm64-4x`
- `warp-windows-latest-x64-4x`
- `warp-macos-latest-arm64-6x`

WarpBuild's $10 free credit is a one-time signup grant, not a monthly
allowance, so the starter config sets `free_credit_usd_per_month: 0`. Pricing
is $0.004 per minute for 2x Linux x64, $0.003 for 2x ARM, $0.016 for 4x
Windows (the smallest Windows size), and $0.08 for 6x macOS. Larger runners
scale linearly by vCPU.

Sources: [WarpBuild cloud runners](https://www.warpbuild.com/docs/ci/cloud-runners),
[WarpBuild pricing](https://www.warpbuild.com/pricing)

## Namespace

Generated labels include:

- `nscloud-ubuntu-24.04-amd64-4x8`
- `nscloud-ubuntu-24.04-arm64-4x8`
- `nscloud-windows-2022-amd64-4x8`
- `nscloud-macos-sequoia-arm64-6x14`

One Namespace unit minute is 1 vCPU with 2 GB of RAM for one minute. Windows
consumes units at 2x and macOS at 10x. Built-in labels use 2 GB per vCPU on
Linux and Windows.

Sources: [Namespace runner configuration](https://namespace.so/docs/reference/github-actions/runner-configuration),
[Namespace billing](https://namespace.so/docs/workspaces/billing-and-limits)

You can also use a profile:

```yaml
providers:
  namespace:
    enabled: true
    profile: default
```

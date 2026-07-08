# CI Provider Landscape

Research date: 2026-07-08.

Pricing, free tiers, and provider APIs change often in this market. Treat these
findings as an implementation starting point and re-verify provider pricing
pages before each release that updates built-in provider metadata.

## Executive Takeaway

Freelane should start as a GitHub Actions runner router, not a general CI
orchestrator. GitHub Actions can evaluate expressions in `runs-on`, and
self-hosted runner providers expose themselves as runner labels. That gives us a
small, practical surface: run a cheap router job, choose a provider, then pass a
dynamic `runs-on` value to the real job.

External CI providers are still interesting, especially CircleCI and GitLab CI,
but they are a second product shape. They require remote pipeline dispatch,
polling or webhook handling, logs/artifacts mapping, and status mirroring.

## GitHub Actions Constraints

GitHub selects the runner before a job starts. A step cannot decide where its own
job runs. The usable pattern is:

1. Run a small `freelane` job on a known runner.
2. Query usage, quotas, health, and config.
3. Output a JSON `runs-on` value.
4. Use that output in downstream jobs with `fromJSON(...)`.

GitHub's workflow syntax supports expressions and variables in `runs-on`, and
self-hosted runners are selected by labels. For providers like Namespace that
need multiple labels, the router can output a JSON array.

Key sources:

- GitHub workflow syntax, including dynamic `runs-on` examples: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- GitHub self-hosted runner REST API: https://docs.github.com/en/rest/actions/self-hosted-runners
- GitHub self-hosted runner label docs: https://docs.github.com/actions/hosting-your-own-runners/using-labels-with-self-hosted-runners

Important limitation: if a selected third-party runner never picks up a job,
that job is already queued and cannot execute fallback code. MVP fallback should
therefore be pre-scheduling fallback based on quota, provider status, and recent
queue health. Later, a monitor workflow or app can cancel and re-dispatch stuck
runs.

## Initial Provider Recommendations

### 1. GitHub

Why support first:

- It is the default provider and requires no third-party account.
- Public repositories get free standard GitHub-hosted runner usage.
- Private repositories get included minutes by plan.
- GitHub has the strongest APIs for workflow history, billing usage, budgets,
  self-hosted runner state, workflow jobs, and alerts.

Useful API surfaces:

- Billing usage reports and summaries: https://docs.github.com/en/rest/billing/usage
- Budgets API: https://docs.github.com/en/rest/billing/budgets
- Workflow jobs API index: https://docs.github.com/en/rest/actions

Adapter status: strong. Use official APIs where available. For remaining free
minutes, support both the newer enhanced billing usage APIs and the legacy
`/settings/billing/actions` endpoint where accounts still expose it.

### 2. Blacksmith

Why support early:

- GitHub Actions compatible runner labels.
- One-line workflow migration.
- Linux, ARM, Windows, and macOS support.
- Pricing page lists 3,000 free minutes per month.

Relevant findings:

- Example label: `blacksmith-2vcpu-ubuntu-2404`.
- Pricing page lists Ubuntu x64 at `$0.004/min` and 3,000 free minutes per
  month.
- Docs describe Blacksmith as a drop-in replacement and say runners are selected
  by changing the workflow tag.

Sources:

- Pricing: https://www.blacksmith.sh/pricing
- Instance types: https://docs.blacksmith.sh/blacksmith-runners/overview
- Quickstart: https://docs.blacksmith.sh/introduction/quickstart
- CI analytics dashboard: https://docs.blacksmith.sh/blacksmith-observability/dashboard

Adapter status: good for routing, weaker for exact quota automation. The public
docs emphasize dashboard visibility but do not document a stable public billing
usage API. MVP should support configured quota plus inferred usage from GitHub
workflow history.

### 3. Ubicloud

Why support early:

- GitHub Actions compatible runner labels.
- Very cheap Linux x64 and ARM64 runners.
- Every account gets a monthly credit that maps cleanly to free runner minutes.
- Open source cloud option for users who care about provider transparency.

Relevant findings:

- Quickstart says each account receives `$2/month` credit, equivalent to 1,250
  free GitHub runner minutes.
- Pricing says new users get premium runners by default, with Linux x64 2 vCPU at
  `$0.0016/min`.
- Labels include `ubicloud-standard-2`, `ubicloud-standard-8`, and OS-specific
  variants.

Sources:

- Quickstart: https://www.ubicloud.com/docs/github-actions-integration/quickstart
- Pricing: https://www.ubicloud.com/docs/about/pricing
- Runner types: https://www.ubicloud.com/docs/github-actions-integration/runner-types
- API reference example for GitHub cache entries: https://www.ubicloud.com/docs/api-reference/github/get-cache-entry-details

Adapter status: strong for routing, medium for usage. The public docs show API
coverage for some GitHub runner adjacent resources, especially cache, but not a
clear runner billing usage endpoint. Start with configured monthly credit and
GitHub workflow-history inference.

### 4. WarpBuild

Why support early:

- GitHub Actions compatible runner labels.
- Linux, ARM64, Windows, macOS, and BYOC support.
- API keys and documented automation endpoints exist.
- Reports page exposes billing, job, and queue analytics with CSV export.

Relevant findings:

- Linux x86 labels include `warp-ubuntu-latest-x64-2x`.
- Linux x86 2 vCPU is `$0.004/min`; Linux ARM64 2 vCPU is `$0.003/min`.
- Reports include per-job billing, queue timing, and CSV export.
- API keys can call documented endpoints such as builder profiles and BYOC runner
  automation.

Sources:

- Pricing: https://www.warpbuild.com/pricing
- Cloud runners: https://www.warpbuild.com/docs/ci/cloud-runners
- API keys: https://www.warpbuild.com/docs/ci/api-keys
- Automation API docs: https://www.warpbuild.com/docs/ci/api-keys/automation
- Reports: https://www.warpbuild.com/docs/ci/features/reports

Adapter status: good for routing and provider metadata. Exact free credit amount
is not published in the pricing page, although the FAQ says users need to add a
payment method when they hit free usage or credit limits. MVP should allow users
to configure their credit amount and optionally import/export report CSV data.

### 5. Namespace

Why support early:

- GitHub Actions compatible runner labels and profiles.
- Linux, ARM64, Windows, and macOS support.
- Strong runner configuration surface.
- Pricing includes a 30-day free trial and paid plans with included unit minutes.

Relevant findings:

- Users can route with profiles such as `namespace-profile-default`.
- Users can route directly with labels like `nscloud-ubuntu-24.04-amd64-4x8`.
- Only one `nscloud` machine label is allowed in `runs-on`.
- Team plan includes 100,000 unit minutes; Business includes 250,000.
- Unit minute equals 1 vCPU and 2 GB RAM for one minute times a platform
  multiplier.

Sources:

- Pricing: https://namespace.so/pricing
- Runner configuration: https://namespace.so/docs/reference/github-actions/runner-configuration
- GitHub Actions solution docs: https://namespace.so/docs/solutions/github-actions

Adapter status: good for routing. Usage automation needs more investigation
through the `nsc` CLI and Namespace APIs. Start with configured quotas and
GitHub workflow-history inference.

## Excluded From MVP

### BuildJet

BuildJet should not be a new provider target. Its site now says BuildJet for
GitHub Actions has been shut down, and the shutdown announcement says runners
were no longer available after 2026-03-31.

Sources:

- Home page notice: https://buildjet.com/
- Shutdown announcement: https://buildjet.com/for-github-actions/blog/we-are-shutting-down

## Later External CI Adapters

### CircleCI

Interesting because Free plan credits are meaningful and open source allowances
are large. CircleCI says Free plan orgs get free compute access, and open source
projects can access up to 400,000 credits per month for Linux, ARM, and Docker.
Private repositories use the normal free plan credits.

Sources:

- Pricing: https://circleci.com/pricing/
- Credits: https://circleci.com/docs/guides/plans-pricing/credits/

Why later: not a GitHub Actions runner. We need to trigger CircleCI pipelines,
wait for completion, and mirror logs/status.

### GitLab CI

GitLab Free namespaces receive 400 compute minutes per month on GitLab.com.
GitLab says REST API monitoring is possible for compute minutes.

Sources:

- Compute minutes: https://docs.gitlab.com/ci/pipelines/compute_minutes/
- Compute minutes FAQ: https://about.gitlab.com/pricing/faq-compute-minutes/

Why later: GitHub repository integration usually means mirroring/importing or
using GitLab pipelines against an external repo, then status bridging.

### Azure Pipelines

Azure DevOps public projects can receive free Microsoft-hosted parallelism, and
private projects can receive a free grant after linking billing. Recent docs say
the free grant requires linking an Azure subscription.

Sources:

- Parallel jobs docs: https://learn.microsoft.com/en-us/azure/devops/pipelines/licensing/concurrent-jobs
- Azure DevOps pricing: https://azure.microsoft.com/en-us/pricing/details/devops/azure-devops-services/

Why later: remote pipeline orchestration and status bridging.

### Travis CI

Travis advertises a free trial with 10,000 build minutes, while paid pricing
starts with usage-based monthly credits.

Sources:

- Quickstart: https://www.travis-ci.com/quickstart/
- Pricing: https://www.travis-ci.com/pricing/

Why later: lower strategic value for a GitHub Actions first router, and OSS free
credit policy has historically been less predictable.

## Product Risks

- Quota truth is uneven. GitHub has strong APIs; several runner providers expose
  dashboards but no documented billing usage API. We need configurable quotas
  and local inference.
- Concurrency creates race conditions. Multiple router jobs can pick the same
  remaining free credits. MVP should support reserves and conservative thresholds.
- Queue-time fallback is hard. Once GitHub queues a job for a label, code cannot
  run until a matching runner starts it.
- Third-party runner trust matters. Provider choice changes where code, secrets,
  artifacts, and network traffic execute.
- Public repos are special. GitHub standard runners are free for public repos, so
  optimization should prefer third-party providers only for speed, capabilities,
  or when users explicitly want to consume external credits.
- We should not encourage account farming or ToS abuse. Users provide their own
  legitimate accounts and quotas.

## MVP Provider Order

1. GitHub
2. Blacksmith
3. Ubicloud
4. WarpBuild
5. Namespace

External CI adapters should follow after the runner-routing core works.

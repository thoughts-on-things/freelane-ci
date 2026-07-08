# 0001: Start With GitHub Actions Runner Routing

Date: 2026-07-08

## Decision

Freelane starts as a GitHub Actions runner router.

## Why

Runner providers such as Blacksmith, Ubicloud, WarpBuild, and Namespace work by
changing `runs-on`. That keeps adoption small and lets workflows stay normal.

External CI systems need remote pipeline dispatch, status mirroring, and log
mapping. That is valuable, but it is a different product surface.

## Consequences

- The router must run in a separate job before the routed job.
- Fallback after a job is already queued is out of scope for MVP.
- Provider usage may start as configured or inferred until native APIs are added.

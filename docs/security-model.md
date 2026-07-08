# Security Model

Freelane changes where jobs execute. That can affect code, secrets, artifacts,
network access, and logs.

## Current Design

- The action reads repository config.
- The action emits a `runs-on` value.
- The routed job runs on the selected provider.
- No provider credentials are required for the first router implementation.

## User Responsibilities

- Install third-party runner apps only for repositories they should access.
- Scope secrets carefully.
- Use GitHub environments for sensitive deploy credentials.
- Review provider terms, data location, and isolation guarantees.
- Prefer pinned runner labels for sensitive workloads.

## Non-Goals

Freelane does not create provider accounts, bypass quotas, or hide usage from CI
providers.

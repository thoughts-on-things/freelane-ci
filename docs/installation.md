# Installation

## One-Off CLI

No install is required for normal setup:

```bash
npx freelane-ci@latest init
npx freelane-ci@latest init github-actions
npx freelane-ci@latest providers list
```

## Project Dev Dependency

Install Freelane when you want a pinned CLI in your repo:

```bash
npm install --save-dev freelane-ci
npx freelane init --output .freelane.yml
npx freelane init github-actions
```

## Global CLI

Global installs are optional:

```bash
npm install -g freelane-ci
freelane init
freelane init github-actions
```

## GitHub Action

Prefer generating the workflow from the CLI:

```bash
npx freelane-ci@latest init github-actions
```

Pin a release when writing the action step by hand:

```yaml
- uses: thoughts-on-things/freelane-ci@v0
  with:
    job: test-linux
```

Use `@main` only when dogfooding this repository or testing unreleased changes.

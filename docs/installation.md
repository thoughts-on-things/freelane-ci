# Installation

## Global CLI

```bash
npm install -g freelane-ci
freelane init
freelane providers list
```

## One-Off CLI

```bash
npx freelane-ci providers list
npx freelane-ci init --output .freelane.yml
```

## Project Dev Install

```bash
npm install --save-dev freelane-ci
npx freelane init --output .freelane.yml
```

## GitHub Action

Pin a release for normal use:

```yaml
- uses: thoughts-on-things/freelane-ci@v0
  with:
    job: test-linux
```

Use `@main` only when dogfooding this repository or testing unreleased changes.

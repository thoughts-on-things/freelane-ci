# Getting Started

## Install

```bash
npm install
npm run build
```

## Resolve A Job Locally

```bash
node dist/cli.js resolve --config examples/freelane.yml --job test-linux
```

JSON output:

```bash
node dist/cli.js resolve --config examples/freelane.yml --job test-linux --format json
```

GitHub output format:

```bash
node dist/cli.js resolve --config examples/freelane.yml --job test-linux --format github-output
```

## Use In GitHub Actions

Freelane must run before the job it routes because GitHub chooses a runner before
job steps execute.

See [examples/github-actions/freelane-routed.yml](../examples/github-actions/freelane-routed.yml).

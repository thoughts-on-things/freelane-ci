# Getting Started

## Install

```bash
npm install
npm run build
```

## Resolve A Job Locally

Create a starter config:

```bash
node dist/cli.js init --output .freelane.yml
```

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

Check configured provider routing:

```bash
node dist/cli.js providers doctor --config examples/freelane.yml
```

Preview all job routing with quota burn carried forward:

```bash
node dist/cli.js plan --config examples/freelane.yml
```

## Use In GitHub Actions

Freelane must run before the job it routes because GitHub chooses a runner before
job steps execute.

See [examples/github-actions/freelane-routed.yml](../examples/github-actions/freelane-routed.yml).

The action validates config by default. Set `validate: false` only when testing
future config fields locally.

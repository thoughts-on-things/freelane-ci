# Releasing

Freelane ships the GitHub Action from `dist/`, so releases must include a fresh
build.

## Checklist

```bash
npm ci
npm run check
npm pack --dry-run
```

Update `package.json` and `CHANGELOG.md`, then tag:

```bash
git tag v0.1.0
git push origin main --tags
```

Pushing a `v*` tag runs `.github/workflows/release.yml`, builds the project,
packs the npm tarball, and creates a GitHub release.

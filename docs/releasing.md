# Releasing

Freelane uses release-please. Merging Conventional Commits to `main` keeps a
release PR updated. Merging that release PR bumps `package.json`, updates
`CHANGELOG.md`, creates the tag, publishes the GitHub release, and then publishes
the npm package.

## Local Checks

```bash
npm ci
npm run check
npm pack --dry-run
```

## GitHub Setup

- Enable npm trusted publishing for `freelane-ci`.
- Use `.github/workflows/release.yml` as the trusted workflow.
- Keep the package public.

The release workflow also uploads the npm tarball and `SHA256SUMS` to the GitHub
release.

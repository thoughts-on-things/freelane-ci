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

- Create or claim the `freelane-ci` package on npm.
- Enable npm trusted publishing for GitHub Actions.
- Set owner/repository to `thoughts-on-things/freelane-ci`.
- Set workflow to `.github/workflows/release.yml`.
- Leave environment blank unless the workflow later adds one.
- Keep the package public.

The release workflow also uploads the npm tarball and `SHA256SUMS` to the GitHub
release. After a successful publish, it moves the major action tag, such as
`v0`, to the new release tag so workflow examples can stay on `@v0`.

## Release Flow

1. Merge Conventional Commits to `main`.
2. Wait for release-please to open or update the release PR.
3. Merge the release PR.
4. Watch the `release` workflow publish npm, upload release assets, and move the
   major action tag.

## Dogfood

This repository dogfoods unreleased action changes with
`thoughts-on-things/freelane-ci@main` in `.github/workflows/ci.yml`.

Published consumers should pin `thoughts-on-things/freelane-ci@v0`.

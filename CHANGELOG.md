# Changelog

## [0.2.1](https://github.com/thoughts-on-things/freelane-ci/compare/v0.2.0...v0.2.1) (2026-07-09)


### Bug Fixes

* **action:** run action on node 24 ([e244bec](https://github.com/thoughts-on-things/freelane-ci/commit/e244becf38d4ae65bbdc2be254f16e1eac4cca49))


### Documentation

* clarify npm trusted publisher setup ([4a3516e](https://github.com/thoughts-on-things/freelane-ci/commit/4a3516ef8a189baeb982a059a853efb575ad655e))

## [0.2.0](https://github.com/thoughts-on-things/freelane-ci/compare/v0.1.0...v0.2.0) (2026-07-09)


### Features

* **action:** add plain label output ([483b2e2](https://github.com/thoughts-on-things/freelane-ci/commit/483b2e29eb8476d56ca4ca51f8ec2627e10c487f))
* **action:** validate config before resolving ([adb376f](https://github.com/thoughts-on-things/freelane-ci/commit/adb376ff30454c229cd565e502a4af66366495fe))
* **cli:** add config init command ([fb56ca8](https://github.com/thoughts-on-things/freelane-ci/commit/fb56ca872159f6f818044f982be2b615d0f44ef4))
* **cli:** add plan command ([3f6041d](https://github.com/thoughts-on-things/freelane-ci/commit/3f6041d30e7ddde2321c3afb31b1d8daaa5a4c82))
* **cli:** add provider doctor command ([53421f1](https://github.com/thoughts-on-things/freelane-ci/commit/53421f137ded591d6516c74128d548d4895b946d))
* **cli:** add providers list command ([d6075aa](https://github.com/thoughts-on-things/freelane-ci/commit/d6075aa5c4685b0ea1fdbbf1e8c52113ef329860))
* **cli:** add usage report command ([65b46fc](https://github.com/thoughts-on-things/freelane-ci/commit/65b46fc8294e266eff1ac648a5ad51c2f81cd81b))
* **config:** add freelane schema ([d44c4aa](https://github.com/thoughts-on-things/freelane-ci/commit/d44c4aa1c36e2ab1173461370824a23d67319ecc))
* **config:** add validate command ([e73e7c0](https://github.com/thoughts-on-things/freelane-ci/commit/e73e7c0499f77fbf78a64bad780b828325a10e93))
* **config:** validate provider references ([a56c032](https://github.com/thoughts-on-things/freelane-ci/commit/a56c032897405667205accf5254a9adb2fd23ade))
* scaffold freelane ci router ([d17a91e](https://github.com/thoughts-on-things/freelane-ci/commit/d17a91e8ee5bfa5f2c483777d99bb49856f6a7ee))
* **usage:** apply synced minutes to routing ([c50e410](https://github.com/thoughts-on-things/freelane-ci/commit/c50e41002a6cef0dbb9ccb06f9e34965568140c7))
* **usage:** sync github workflow history ([d9afaf3](https://github.com/thoughts-on-things/freelane-ci/commit/d9afaf33a203734857567b521ea52fe20a7c98fc))


### Bug Fixes

* **action:** bundle runtime dependencies ([a6d6876](https://github.com/thoughts-on-things/freelane-ci/commit/a6d6876ced2a1c19e7c19674cf86b0f17991c2b6))
* **init:** use remote schema url ([afa4cbd](https://github.com/thoughts-on-things/freelane-ci/commit/afa4cbd108401fc96500ae47f5cdaa9c51706f91))
* **providers:** correct namespace macos labels ([4b93792](https://github.com/thoughts-on-things/freelane-ci/commit/4b93792598646b2262ee304d432ac179afa52cc2))


### Documentation

* add usage sync workflow example ([5a634a6](https://github.com/thoughts-on-things/freelane-ci/commit/5a634a659053c19db691472eb545eceb2d28fb08))


### Build System

* **deps-dev:** bump vitest from 3.2.7 to 4.1.10 ([41e6358](https://github.com/thoughts-on-things/freelane-ci/commit/41e6358cebf1fe0b2dd4bbb026dfb43113a34f5f))
* **deps-dev:** bump vitest from 3.2.7 to 4.1.10 ([029123b](https://github.com/thoughts-on-things/freelane-ci/commit/029123b95e29870266128365180e593a84f2df49))
* **deps:** bump the github-actions group with 2 updates ([#8](https://github.com/thoughts-on-things/freelane-ci/issues/8)) ([b4b204b](https://github.com/thoughts-on-things/freelane-ci/commit/b4b204bd6b0fb8683edfd9973ef1419628e7d6bc))
* **deps:** bump the npm-dependencies group with 3 updates ([#9](https://github.com/thoughts-on-things/freelane-ci/issues/9)) ([402196f](https://github.com/thoughts-on-things/freelane-ci/commit/402196f09c8c3d69014dec856f0b5d4eea87128e))

## Changelog

## Unreleased

- Bundle GitHub Action runtime dependencies.
- Dogfood Freelane `@main` in CI.
- Add release-please npm publishing workflow.
- Document CLI installation paths.
- Add plain runner label output for simple GitHub workflows.
- Dogfood the local GitHub Action in CI.
- Add GitHub Actions usage sync workflow example.
- Add tag-based release workflow.
- Verify provider label docs and correct Namespace macOS labels.
- Apply synced GitHub minute usage during routing.
- Add GitHub Actions usage sync from workflow job history.
- Add usage report CLI command for configured quota state.
- Use a remote schema URL in starter configs.
- Validate config by default in the GitHub Action.
- Add plan CLI command for multi-job quota simulation.
- Add providers list CLI command.
- Check provider references during config validation.
- Add config validate CLI command.
- Add init CLI command for starter configs.
- Add provider doctor CLI command.
- Add JSON Schema for Freelane config.
- Scaffold GitHub Action and CLI router.
- Add provider research and MVP architecture.

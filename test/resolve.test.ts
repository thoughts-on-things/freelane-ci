import { describe, expect, it } from "vitest";
import type { FreelaneConfig } from "../src/types";
import { resolveFreelane } from "../src/resolve";

const baseConfig: FreelaneConfig = {
  version: 1,
  defaults: {
    paid: "avoid",
    fallback: {
      mode: "pre_schedule",
      providers: ["github"]
    }
  },
  providers: {
    github: { enabled: true },
    blacksmith: { enabled: true, free_minutes_per_month: 3000 },
    ubicloud: { enabled: true, free_credit_usd_per_month: 2 },
    warpbuild: { enabled: true, free_credit_usd_per_month: 10 },
    namespace: { enabled: true, unit_minutes_per_month: 100000 }
  },
  jobs: {
    test: {
      os: "linux",
      arch: "x64",
      min_vcpu: 2,
      estimate_minutes: 8,
      providers: ["blacksmith", "ubicloud", "github"]
    }
  }
};

describe("resolveFreelane", () => {
  it("selects the first provider with configured free quota", () => {
    const decision = resolveFreelane(baseConfig, "test");

    expect(decision.provider).toBe("blacksmith");
    expect(decision.runner).toBe("blacksmith-2vcpu-ubuntu-2404");
    expect(decision.runsOnJson).toBe('"blacksmith-2vcpu-ubuntu-2404"');
    expect(decision.paidRequired).toBe(false);
  });

  it("falls back when earlier providers are out of quota", () => {
    const config: FreelaneConfig = {
      ...baseConfig,
      providers: {
        ...baseConfig.providers,
        blacksmith: {
          enabled: true,
          free_minutes_per_month: 3000,
          used_minutes: 3000
        }
      }
    };

    const decision = resolveFreelane(config, "test");

    expect(decision.provider).toBe("ubicloud");
    expect(decision.runner).toBe("ubicloud-standard-2");
  });

  it("uses configured fallback providers when free quota is gone", () => {
    const config: FreelaneConfig = {
      ...baseConfig,
      providers: {
        ...baseConfig.providers,
        blacksmith: { enabled: true, free_minutes_per_month: 1, used_minutes: 1 },
        ubicloud: { enabled: true, free_credit_usd_per_month: 0, used_credit_usd: 0 }
      }
    };

    const decision = resolveFreelane(config, "test");

    expect(decision.provider).toBe("github");
    expect(decision.runner).toBe("ubuntu-latest");
  });

  it("supports Namespace unit-minute labels", () => {
    const config: FreelaneConfig = {
      ...baseConfig,
      jobs: {
        test: {
          os: "linux",
          arch: "arm64",
          min_vcpu: 4,
          estimate_minutes: 10,
          providers: ["namespace"]
        }
      }
    };

    const decision = resolveFreelane(config, "test");

    expect(decision.provider).toBe("namespace");
    expect(decision.runner).toBe("nscloud-ubuntu-24.04-arm64-4x8");
    expect(decision.quotaBurn).toBe(40);
  });

  it("supports Namespace macOS labels", () => {
    const config: FreelaneConfig = {
      ...baseConfig,
      jobs: {
        test: {
          os: "macos",
          arch: "arm64",
          min_vcpu: 6,
          estimate_minutes: 10,
          providers: ["namespace"]
        }
      }
    };

    const decision = resolveFreelane(config, "test");

    expect(decision.runner).toBe("nscloud-macos-sequoia-arm64-6x14");
  });

  it("uses Blacksmith normalized free-minute rates", () => {
    const jobs: FreelaneConfig["jobs"] = {
      arm: { os: "linux", arch: "arm64", min_vcpu: 2, estimate_minutes: 10, providers: ["blacksmith"] },
      windows: { os: "windows", arch: "x64", min_vcpu: 2, estimate_minutes: 10, providers: ["blacksmith"] },
      macos: { os: "macos", arch: "arm64", min_vcpu: 6, estimate_minutes: 10, providers: ["blacksmith"] }
    };
    const config: FreelaneConfig = { ...baseConfig, jobs };

    expect(resolveFreelane(config, "arm").quotaBurn).toBe(6.25);
    expect(resolveFreelane(config, "windows").quotaBurn).toBe(20);
    expect(resolveFreelane(config, "macos").quotaBurn).toBe(200);
  });

  it("honors job-level runner overrides", () => {
    const config: FreelaneConfig = {
      ...baseConfig,
      jobs: {
        test: {
          os: "linux",
          runner: ["self-hosted", "linux", "x64", "gpu"]
        }
      }
    };

    const decision = resolveFreelane(config, "test");

    expect(decision.provider).toBe("manual");
    expect(decision.runsOnJson).toBe('["self-hosted","linux","x64","gpu"]');
  });
});

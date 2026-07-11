import { describe, expect, it } from "vitest";
import { applyUsageState } from "../src/usage-state";
import type { GitHubUsageState } from "../src/github-usage";
import type { FreelaneConfig } from "../src/types";

describe("applyUsageState", () => {
  it("applies synced minutes to minute-based providers", () => {
    const config = configWithProviders({
      blacksmith: { enabled: true, free_minutes_per_month: 100 }
    });

    const next = applyUsageState(config, stateWithProviders({
      blacksmith: { jobs: 2, minutes: 25 }
    }));

    expect(next.providers.blacksmith.used_minutes).toBe(25);
    expect(config.providers.blacksmith.used_minutes).toBeUndefined();
  });

  it("treats synced usage as authoritative instead of double counting configured state", () => {
    const config = configWithProviders({
      github: { enabled: true, free_minutes_per_month: 100, used_minutes: 10 }
    });

    const next = applyUsageState(config, stateWithProviders({ github: { jobs: 2, minutes: 25 } }));

    expect(next.providers.github.used_minutes).toBe(25);
  });

  it("leaves credit-based providers unchanged", () => {
    const config = configWithProviders({
      ubicloud: { enabled: true, free_credit_usd_per_month: 2 }
    });

    const next = applyUsageState(config, stateWithProviders({
      ubicloud: { jobs: 2, minutes: 25 }
    }));

    expect(next.providers.ubicloud.used_credit_usd).toBeUndefined();
  });

  it("applies learned P75 durations when config has no override", () => {
    const config = configWithProviders({ github: { enabled: true, free_minutes_per_month: 100 } });
    const state = stateWithProviders({ github: { jobs: 3, minutes: 14 } });
    state.estimates = {
      names: {},
      platforms: {
        "linux:x64": { samples: 3, p50: 4, p75: 7.5, p90: 9 }
      }
    };

    const next = applyUsageState(config, state);

    expect(next.jobs.test.estimate_minutes).toBe(7.5);
    expect(config.jobs.test.estimate_minutes).toBeUndefined();
  });
});

function configWithProviders(providers: FreelaneConfig["providers"]): FreelaneConfig {
  return {
    version: 1,
    providers,
    jobs: {
      test: { os: "linux" }
    }
  };
}

function stateWithProviders(providers: GitHubUsageState["providers"]): GitHubUsageState {
  return {
    source: "github-actions",
    repository: "owner/repo",
    generatedAt: "2026-07-08T00:00:00.000Z",
    since: "2026-06-08T00:00:00.000Z",
    runCount: 1,
    jobCount: 1,
    providers,
    jobs: []
  };
}

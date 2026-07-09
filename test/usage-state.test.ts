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

  it("leaves credit-based providers unchanged", () => {
    const config = configWithProviders({
      ubicloud: { enabled: true, free_credit_usd_per_month: 2 }
    });

    const next = applyUsageState(config, stateWithProviders({
      ubicloud: { jobs: 2, minutes: 25 }
    }));

    expect(next.providers.ubicloud.used_credit_usd).toBeUndefined();
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

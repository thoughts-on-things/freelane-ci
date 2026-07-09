import { describe, expect, it } from "vitest";
import { formatPlan, planFreelane } from "../src/plan";
import type { FreelaneConfig } from "../src/types";

describe("planFreelane", () => {
  it("carries quota usage across jobs", () => {
    const config: FreelaneConfig = {
      version: 1,
      providers: {
        blacksmith: { enabled: true, free_minutes_per_month: 10 },
        ubicloud: { enabled: true, free_credit_usd_per_month: 2 },
        github: { enabled: true }
      },
      jobs: {
        first: {
          os: "linux",
          estimate_minutes: 8,
          providers: ["blacksmith", "ubicloud", "github"]
        },
        second: {
          os: "linux",
          estimate_minutes: 8,
          providers: ["blacksmith", "ubicloud", "github"]
        }
      }
    };

    const plan = planFreelane(config);

    expect(plan.decisions.map((decision) => decision.provider)).toEqual(["blacksmith", "ubicloud"]);
    expect(plan.decisions[0].remaining).toBe(2);
  });

  it("formats a text plan", () => {
    const plan = {
      decisions: [
        {
          job: "test",
          provider: "github",
          runner: "ubuntu-latest",
          label: "ubuntu-latest",
          runsOnJson: "\"ubuntu-latest\"",
          reason: "selected github within configured free quota",
          paidRequired: false,
          quotaUnit: "unlimited" as const,
          quotaBurn: 0,
          available: Number.POSITIVE_INFINITY,
          remaining: Number.POSITIVE_INFINITY
        }
      ]
    };

    expect(formatPlan(plan, "text")).toContain("job\tprovider\trunner\tburn\tremaining\treason");
    expect(formatPlan(plan, "text")).toContain("test\tgithub");
    expect(formatPlan(plan, "text")).toContain("0\tunlimited");
  });
});

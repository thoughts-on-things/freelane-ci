import { describe, expect, it } from "vitest";
import { formatUsageReport, usageReport } from "../src/usage";
import type { FreelaneConfig } from "../src/types";

describe("usageReport", () => {
  it("reports configured quota state", () => {
    const config: FreelaneConfig = {
      version: 1,
      defaults: {
        reserve: {
          blacksmith: 10
        }
      },
      providers: {
        github: { enabled: true },
        blacksmith: {
          enabled: true,
          free_minutes_per_month: 100,
          used_minutes: 25
        }
      },
      jobs: {
        test: { os: "linux" }
      }
    };

    const report = usageReport(config);

    expect(report.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: "blacksmith",
        quotaUnit: "minutes",
        total: 100,
        used: 25,
        reserve: 10,
        available: 65
      })
    ]));
  });

  it("formats text output", () => {
    const report = {
      entries: [
        {
          provider: "github",
          enabled: true,
          quotaUnit: "unlimited" as const,
          total: "unlimited" as const,
          used: 0,
          reserve: 0,
          available: "unlimited" as const
        }
      ]
    };

    expect(formatUsageReport(report, "text")).toContain("github\ttrue\tunlimited\t0\t0\tunlimited");
  });
});

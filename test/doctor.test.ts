import { describe, expect, it } from "vitest";
import { doctorConfig, formatDoctor } from "../src/doctor";
import type { FreelaneConfig } from "../src/types";

describe("doctorConfig", () => {
  it("reports provider runner and quota status", () => {
    const config: FreelaneConfig = {
      version: 1,
      providers: {
        blacksmith: { enabled: true, free_minutes_per_month: 3000 },
        missingquota: { enabled: true }
      },
      jobs: {
        test: {
          os: "linux",
          arch: "x64",
          estimate_minutes: 5,
          providers: ["blacksmith", "github"]
        }
      }
    };

    const report = doctorConfig(config);

    expect(report.entries[0]).toMatchObject({
      job: "test",
      provider: "blacksmith",
      status: "ok",
      runner: "blacksmith-2vcpu-ubuntu-2404",
      quotaBurn: 5
    });
    expect(report.entries[1]).toMatchObject({
      provider: "github",
      status: "missing"
    });
  });

  it("formats text reports", () => {
    const report = {
      entries: [
        {
          job: "test",
          provider: "github",
          status: "ok" as const,
          runner: "ubuntu-latest",
          message: "burns 0 unlimited; Infinity available"
        }
      ]
    };

    expect(formatDoctor(report, "text")).toBe('ok\ttest\tgithub\t"ubuntu-latest"\tburns 0 unlimited; Infinity available\n');
  });
});

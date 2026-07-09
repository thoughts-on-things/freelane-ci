import { describe, expect, it } from "vitest";
import { formatDecision } from "../src/format";
import type { RoutingDecision } from "../src/types";

const decision: RoutingDecision = {
  job: "test",
  provider: "github",
  runner: "ubuntu-latest",
  label: "ubuntu-latest",
  runsOnJson: '"ubuntu-latest"',
  reason: "selected github",
  paidRequired: false,
  quotaUnit: "unlimited",
  quotaBurn: 0,
  available: Number.POSITIVE_INFINITY
};

describe("formatDecision", () => {
  it("formats GitHub output lines", () => {
    expect(formatDecision(decision, "github-output")).toContain('runs_on="ubuntu-latest"');
    expect(formatDecision(decision, "github-output")).toContain("label=ubuntu-latest");
    expect(formatDecision(decision, "github-output")).toContain("provider=github");
  });

  it("formats json", () => {
    expect(JSON.parse(formatDecision(decision, "json")).provider).toBe("github");
  });
});

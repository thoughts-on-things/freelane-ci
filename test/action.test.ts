import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FreelaneConfig } from "../src/types";

const outputs = new Map<string, unknown>();
const inputs = new Map<string, string>();
const summary = {
  addHeading: vi.fn(),
  addTable: vi.fn(),
  write: vi.fn(async () => undefined)
};
summary.addHeading.mockReturnValue(summary);
summary.addTable.mockReturnValue(summary);

vi.mock("@actions/core", () => ({
  getInput: (name: string) => inputs.get(name) ?? "",
  getBooleanInput: () => false,
  setOutput: (name: string, value: unknown) => outputs.set(name, value),
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  setFailed: vi.fn(),
  summary
}));

const config: FreelaneConfig = {
  version: 1,
  providers: {
    github: { enabled: true, free_minutes_per_month: 15 },
    blacksmith: { enabled: true, free_minutes_per_month: 100 }
  },
  jobs: {
    first: { os: "linux", estimate_minutes: 10, providers: ["github", "blacksmith"] },
    second: { os: "linux", estimate_minutes: 10, providers: ["github", "blacksmith"] }
  }
};

vi.mock("../src/config", () => ({ loadConfig: () => config }));

describe("GitHub action batch routing", () => {
  beforeEach(() => {
    outputs.clear();
    inputs.clear();
    inputs.set("jobs", JSON.stringify([
      { job: "first", alias: "first" },
      { job: "second", alias: "second" }
    ]));
    inputs.set("sync_usage", "false");
  });

  it("reserves quota across every job in one workflow plan", async () => {
    const { run } = await import("../src/action");

    await run();

    expect(outputs.get("first_provider")).toBe("github");
    expect(outputs.get("first")).toBe("ubuntu-latest");
    expect(outputs.get("second_provider")).toBe("blacksmith");
    expect(outputs.get("second")).toBe("blacksmith-2vcpu-ubuntu-2404");
  });
});

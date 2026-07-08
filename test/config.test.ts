import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("loads valid yaml config", () => {
    const dir = mkdtempSync(join(tmpdir(), "freelane-"));
    const path = join(dir, ".freelane.yml");
    writeFileSync(
      path,
      [
        "version: 1",
        "providers:",
        "  github:",
        "    enabled: true",
        "jobs:",
        "  test:",
        "    os: linux"
      ].join("\n")
    );

    const config = loadConfig(path);

    expect(config.jobs.test.os).toBe("linux");
  });

  it("rejects unknown operating systems", () => {
    const dir = mkdtempSync(join(tmpdir(), "freelane-"));
    const path = join(dir, ".freelane.yml");
    writeFileSync(
      path,
      [
        "version: 1",
        "providers:",
        "  github:",
        "    enabled: true",
        "jobs:",
        "  test:",
        "    os: solaris"
      ].join("\n")
    );

    expect(() => loadConfig(path)).toThrow(/os must be/);
  });
});

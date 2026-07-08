import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatValidation, validateConfigFile } from "../src/schema";

describe("validateConfigFile", () => {
  it("validates a config file", () => {
    const dir = mkdtempSync(join(tmpdir(), "freelane-schema-"));
    const path = join(dir, ".freelane.yml");

    writeFileSync(path, "version: 1\nproviders:\n  github: {}\njobs:\n  test:\n    os: linux\n");

    expect(validateConfigFile(path).valid).toBe(true);
  });

  it("reports schema issues", () => {
    const dir = mkdtempSync(join(tmpdir(), "freelane-schema-"));
    const path = join(dir, ".freelane.yml");

    writeFileSync(path, "version: 1\nproviders:\n  github: {}\njobs:\n  test:\n    os: aix\n");

    const result = validateConfigFile(path);
    expect(result.valid).toBe(false);
    expect(formatValidation(result, "text")).toContain("invalid");
  });

  it("reports unknown provider references", () => {
    const dir = mkdtempSync(join(tmpdir(), "freelane-schema-"));
    const path = join(dir, ".freelane.yml");

    writeFileSync(path, [
      "version: 1",
      "defaults:",
      "  reserve:",
      "    missing-reserve: 10",
      "  fallback:",
      "    providers: [missing-fallback]",
      "providers:",
      "  github: {}",
      "jobs:",
      "  test:",
      "    os: linux",
      "    providers: [github, missing-job]"
    ].join("\n"));

    const result = validateConfigFile(path);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "/defaults/reserve/missing-reserve" }),
      expect.objectContaining({ path: "/defaults/fallback/providers/0" }),
      expect.objectContaining({ path: "/jobs/test/providers/1" })
    ]));
  });
});

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
});

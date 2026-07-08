import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { starterConfig, writeStarterConfig } from "../src/init";
import { loadConfig } from "../src/config";

describe("writeStarterConfig", () => {
  it("writes a safe starter config", () => {
    const dir = mkdtempSync(join(tmpdir(), "freelane-init-"));
    const path = writeStarterConfig({ cwd: dir });

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("github:");
    expect(loadConfig(path).providers.github.enabled).toBe(true);
    expect(loadConfig(path).providers.blacksmith.enabled).toBe(false);
  });

  it("refuses to overwrite unless forced", () => {
    const dir = mkdtempSync(join(tmpdir(), "freelane-init-"));
    writeStarterConfig({ cwd: dir });

    expect(() => writeStarterConfig({ cwd: dir })).toThrow(/already exists/);
    expect(() => writeStarterConfig({ cwd: dir, force: true })).not.toThrow();
  });

  it("emits yaml", () => {
    expect(starterConfig()).toContain("version: 1");
  });
});

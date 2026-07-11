import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { resolveFreelane } from "../src/resolve";
import { setupGitHubActions } from "../src/setup";

describe("setupGitHubActions", () => {
  it("discovers jobs, creates config, and migrates multiple workflows", () => {
    const cwd = mkdtempSync(join(tmpdir(), "freelane-setup-"));
    const workflows = join(cwd, ".github", "workflows");
    mkdirSync(workflows, { recursive: true });
    const ci = join(workflows, "ci.yml");
    const launcher = join(workflows, "launcher.yml");
    writeFileSync(ci, [
      "name: CI",
      "on: [pull_request]",
      "jobs:",
      "  check:",
      "    runs-on: blacksmith-2vcpu-ubuntu-2404-arm",
      "    steps:",
      "      - run: pnpm test",
      "  dynamic:",
      "    runs-on: ${{ matrix.runner }}",
      ""
    ].join("\n"));
    writeFileSync(launcher, [
      "jobs:",
      "  windows:",
      "    runs-on: blacksmith-2vcpu-windows-2025",
      "    steps:",
      "      - run: cargo build",
      ""
    ].join("\n"));

    const result = setupGitHubActions({ cwd, githubPlan: "team", workflows: [ci, launcher] });
    const config = loadConfig(join(cwd, ".freelane.yml"));

    expect(result.jobs).toBe(2);
    expect(result.skipped).toEqual([
      expect.objectContaining({ workflowJob: "dynamic", reason: "unsupported runner: ${{ matrix.runner }}" })
    ]);
    expect(config.providers.blacksmith.free_minutes_per_month).toBe(3000);
    expect(config.providers.github.free_minutes_per_month).toBe(3000);
    expect(config.defaults?.fallback?.providers).toEqual(["github"]);
    expect(config.jobs.check).toMatchObject({ os: "linux", arch: "arm64", min_vcpu: 2, providers: ["github", "blacksmith"] });
    expect(resolveFreelane(config, "check").provider).toBe("github");
    expect(config.jobs.windows).toMatchObject({ os: "windows", arch: "x64" });
    expect(readFileSync(join(cwd, ".freelane.yml"), "utf8")).not.toMatch(/[&*]a\d/);
    expect(readFileSync(ci, "utf8")).toContain("runs-on: ${{ needs.freelane.outputs.check }}");
    expect(readFileSync(launcher, "utf8")).toContain("runs-on: ${{ needs.freelane.outputs.windows }}");
  });

  it("models public GitHub standard runners as unlimited", () => {
    const cwd = mkdtempSync(join(tmpdir(), "freelane-setup-"));
    const workflow = join(cwd, "ci.yml");
    writeFileSync(workflow, "jobs:\n  test:\n    runs-on: ubuntu-latest\n");

    setupGitHubActions({ cwd, githubPlan: "public", providers: ["github"], workflows: [workflow] });
    const config = loadConfig(join(cwd, ".freelane.yml"));

    expect(config.providers.github.free_minutes_per_month).toBeUndefined();
    expect(resolveFreelane(config, "test").provider).toBe("github");
  });

  it("namespaces duplicate workflow job ids", () => {
    const cwd = mkdtempSync(join(tmpdir(), "freelane-setup-"));
    const first = join(cwd, "ci.yml");
    const second = join(cwd, "release.yml");
    writeFileSync(first, "jobs:\n  build:\n    runs-on: ubuntu-latest\n");
    writeFileSync(second, "jobs:\n  build:\n    runs-on: windows-latest\n");

    setupGitHubActions({ cwd, providers: ["github"], workflows: [first, second] });
    const config = loadConfig(join(cwd, ".freelane.yml"));

    expect(Object.keys(config.jobs)).toEqual(["ci-build", "release-build"]);
    expect(config.providers.github.free_minutes_per_month).toBe(0);
    expect(readFileSync(first, "utf8")).toContain("Route ci-build");
    expect(readFileSync(second, "utf8")).toContain("Route release-build");
  });
});

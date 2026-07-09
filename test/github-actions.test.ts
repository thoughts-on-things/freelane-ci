import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateGitHubActionsWorkflow,
  githubActionsAliases,
  sanitizeOutputName,
  writeGitHubActionsWorkflow
} from "../src/github-actions";
import type { FreelaneConfig } from "../src/types";

const config: FreelaneConfig = {
  version: 1,
  providers: {
    github: { enabled: true },
    blacksmith: { enabled: true, free_minutes_per_month: 3000 }
  },
  jobs: {
    "test-linux": {
      os: "linux",
      arch: "x64",
      providers: ["blacksmith", "github"]
    },
    "rust/windows": {
      os: "windows",
      providers: ["blacksmith", "github"]
    }
  }
};

describe("github actions workflow generation", () => {
  it("creates stable GitHub output aliases", () => {
    expect(sanitizeOutputName("test-linux")).toBe("test_linux");
    expect(sanitizeOutputName("1 windows")).toBe("job_1_windows");
    expect(githubActionsAliases(config)).toEqual([
      { job: "test-linux", alias: "test_linux" },
      { job: "rust/windows", alias: "rust_windows" }
    ]);
  });

  it("generates a routed workflow from config jobs", () => {
    const workflow = generateGitHubActionsWorkflow(config, {
      configPath: "ci/freelane.yml",
      uses: "thoughts-on-things/freelane-ci@main"
    });

    expect(workflow).toContain("test_linux: ${{ steps.test_linux.outputs.label }}");
    expect(workflow).toContain("test_linux_runs_on: ${{ steps.test_linux.outputs.runs_on }}");
    expect(workflow).toContain("run: npx --yes freelane-ci@latest config validate --config ci/freelane.yml");
    expect(workflow).toContain("uses: thoughts-on-things/freelane-ci@main");
    expect(workflow).toContain("runs-on: ${{ needs.freelane.outputs.rust_windows }}");
  });

  it("writes a workflow without overwriting by default", () => {
    const dir = mkdtempSync(join(tmpdir(), "freelane-gha-"));
    const path = writeGitHubActionsWorkflow(config, { cwd: dir });

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("name: Freelane CI");
    expect(() => writeGitHubActionsWorkflow(config, { cwd: dir })).toThrow(/already exists/);
    expect(() => writeGitHubActionsWorkflow(config, { cwd: dir, force: true })).not.toThrow();
  });
});

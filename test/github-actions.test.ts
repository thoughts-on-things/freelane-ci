import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateGitHubActionsWorkflow,
  githubActionsAliases,
  migrateGitHubActionsWorkflowContent,
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
    expect(sanitizeOutputName(`test${"_".repeat(10000)}linux`)).toBe("test_linux");
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

    expect(workflow).toContain("test_linux: ${{ steps.route.outputs.test_linux }}");
    expect(workflow).not.toContain("test_linux_runs_on:");
    expect(workflow.match(/uses: thoughts-on-things\/freelane-ci@main/g)).toHaveLength(1);
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

  it("migrates matching jobs in an existing workflow", () => {
    const workflow = [
      "name: CI",
      "on:",
      "  pull_request:",
      "jobs:",
      "  test-linux:",
      "    runs-on: blacksmith-2vcpu-ubuntu-2404",
      "    steps:",
      "      - uses: actions/checkout@v7",
      "      - run: npm test",
      "  docs:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: npm run docs",
      ""
    ].join("\n");

    const migration = migrateGitHubActionsWorkflowContent(config, workflow);

    expect(migration.changed).toBe(true);
    expect(migration.routed).toEqual([
      {
        alias: "test_linux",
        freelaneJob: "test-linux",
        runner: "blacksmith-2vcpu-ubuntu-2404",
        workflowJob: "test-linux"
      }
    ]);
    expect(migration.content).toContain("freelane:");
    expect(migration.content).toContain("needs: freelane");
    expect(migration.content).toContain("runs-on: ${{ needs.freelane.outputs.test_linux }}");
    expect(migration.content).toContain("Route workflow jobs");
  });

  it("preserves comments and formatting outside required edits", () => {
    const workflow = [
      "name: CI",
      "",
      "# Keep this workflow documentation.",
      "on: [pull_request]",
      "",
      "permissions:",
      "  contents: read # least privilege",
      "",
      "jobs:",
      "  test-linux:",
      "    # Keep the runner rationale.",
      "    runs-on: blacksmith-2vcpu-ubuntu-2404",
      "    if: >-",
      "      github.event_name != 'pull_request' ||",
      "      github.actor != 'dependabot[bot]'",
      "    strategy:",
      "      matrix:",
      "        app: [web, api]",
      "    steps:",
      "      - run: npm test",
      ""
    ].join("\n");

    const migration = migrateGitHubActionsWorkflowContent(config, workflow);

    expect(migration.content).toContain("# Keep this workflow documentation.");
    expect(migration.content).toContain("    # Keep the runner rationale.");
    expect(migration.content).toContain("    if: >-\n      github.event_name != 'pull_request' ||");
    expect(migration.content).toContain("        app: [web, api]");
    expect(migration.content).toContain("  contents: read # least privilege\n  actions: read");
  });

  it("preserves CRLF line endings", () => {
    const workflow = "jobs:\r\n  test-linux:\r\n    runs-on: blacksmith-2vcpu-ubuntu-2404\r\n";

    const migration = migrateGitHubActionsWorkflowContent(config, workflow);

    expect(migration.content.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("extends flow-style permissions without reformatting", () => {
    const workflow = "permissions: { contents: read }\njobs:\n  test-linux:\n    runs-on: blacksmith-2vcpu-ubuntu-2404\n";

    const migration = migrateGitHubActionsWorkflowContent(config, workflow);

    expect(migration.content).toContain("permissions: { contents: read, actions: read }");
  });

  it("uses explicit job maps during migration", () => {
    const workflow = [
      "name: CI",
      "on: [pull_request]",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: npm test",
      ""
    ].join("\n");

    const migration = migrateGitHubActionsWorkflowContent(config, workflow, {
      jobMap: {
        check: "test-linux"
      }
    });

    expect(migration.routed[0]?.workflowJob).toBe("check");
    expect(migration.routed[0]?.freelaneJob).toBe("test-linux");
    expect(migration.content).toContain("runs-on: ${{ needs.freelane.outputs.test_linux }}");
  });

  it("uses JSON runner outputs for multi-label runners", () => {
    const arrayConfig: FreelaneConfig = {
      version: 1,
      providers: { github: { enabled: true } },
      jobs: {
        gpu: {
          os: "linux",
          runner: ["self-hosted", "linux", "gpu"]
        }
      }
    };
    const generated = generateGitHubActionsWorkflow(arrayConfig);
    const migrated = migrateGitHubActionsWorkflowContent(
      arrayConfig,
      "jobs:\n  gpu:\n    runs-on: self-hosted\n    steps:\n      - run: npm test\n"
    );

    expect(generated).toContain("runs-on: ${{ fromJSON(needs.freelane.outputs.gpu_runs_on) }}");
    expect(migrated.content).toContain("runs-on: ${{ fromJSON(needs.freelane.outputs.gpu_runs_on) }}");
  });

  it("rejects job maps that reference unknown Freelane jobs", () => {
    expect(() =>
      migrateGitHubActionsWorkflowContent(
        config,
        "jobs:\n  check:\n    runs-on: ubuntu-latest\n",
        { jobMap: { check: "typo" } }
      )
    ).toThrow(/unknown Freelane job: typo/);
  });
});

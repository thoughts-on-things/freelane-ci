import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { FreelaneConfig } from "./types";

export const DEFAULT_WORKFLOW_OUTPUT = ".github/workflows/freelane-ci.yml";
export const DEFAULT_ACTION_REF = "thoughts-on-things/freelane-ci@v0";

export interface GitHubActionsWorkflowOptions {
  configPath?: string;
  uses?: string;
  workflowName?: string;
}

export interface WriteGitHubActionsWorkflowOptions extends GitHubActionsWorkflowOptions {
  cwd?: string;
  force?: boolean;
  output?: string;
}

export interface WorkflowAlias {
  job: string;
  alias: string;
}

export function githubActionsAliases(config: FreelaneConfig): WorkflowAlias[] {
  const seen = new Map<string, number>();

  return Object.keys(config.jobs).map((job) => {
    const base = sanitizeOutputName(job);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return {
      job,
      alias: count === 0 ? base : `${base}_${count + 1}`
    };
  });
}

export function generateGitHubActionsWorkflow(
  config: FreelaneConfig,
  options: GitHubActionsWorkflowOptions = {}
): string {
  const aliases = githubActionsAliases(config);
  const configPath = options.configPath ?? ".freelane.yml";
  const uses = options.uses ?? DEFAULT_ACTION_REF;
  const workflowName = options.workflowName ?? "Freelane CI";
  const lines: string[] = [
    `name: ${yamlString(workflowName)}`,
    "",
    "on:",
    "  pull_request:",
    "  push:",
    "    branches:",
    "      - main",
    "",
    "permissions:",
    "  contents: read",
    "",
    "jobs:",
    "  freelane:",
    "    name: Choose runners",
    "    runs-on: ubuntu-latest",
    "    outputs:"
  ];

  for (const alias of aliases) {
    lines.push(
      `      ${alias.alias}: \${{ steps.${alias.alias}.outputs.label }}`,
      `      ${alias.alias}_runs_on: \${{ steps.${alias.alias}.outputs.runs_on }}`,
      `      ${alias.alias}_provider: \${{ steps.${alias.alias}.outputs.provider }}`,
      `      ${alias.alias}_reason: \${{ steps.${alias.alias}.outputs.reason }}`
    );
  }

  lines.push(
    "    steps:",
    "      - uses: actions/checkout@v7",
    `      - name: Check ${yamlString(configPath)}`,
    `        run: npx --yes freelane-ci@latest config validate --config ${shellArg(configPath)}`,
    "      - name: Preview routing",
    `        run: npx --yes freelane-ci@latest plan --config ${shellArg(configPath)}`
  );

  for (const alias of aliases) {
    lines.push(
      `      - id: ${alias.alias}`,
      `        name: Route ${yamlString(alias.job)}`,
      `        uses: ${yamlString(uses)}`,
      "        with:",
      `          config: ${yamlString(configPath)}`,
      `          job: ${yamlString(alias.job)}`,
      "          validate: true"
    );
  }

  for (const alias of aliases) {
    lines.push(
      "",
      `  ${alias.alias}:`,
      `    name: ${yamlString(alias.job)}`,
      "    needs: freelane",
      `    runs-on: \${{ needs.freelane.outputs.${alias.alias} }}`,
      "    steps:",
      "      - uses: actions/checkout@v7",
      `      - run: echo "Replace this with the ${shellSafe(alias.job)} CI command"`
    );
  }

  return lines.join("\n") + "\n";
}

export function writeGitHubActionsWorkflow(
  config: FreelaneConfig,
  options: WriteGitHubActionsWorkflowOptions = {}
): string {
  const output = resolve(options.cwd ?? process.cwd(), options.output ?? DEFAULT_WORKFLOW_OUTPUT);
  if (existsSync(output) && !options.force) {
    throw new Error(`${output} already exists; pass --force to overwrite`);
  }

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, generateGitHubActionsWorkflow(config, options), "utf8");
  return output;
}

export function sanitizeOutputName(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  const fallback = sanitized || "job";
  return /^[0-9]/.test(fallback) ? `job_${fallback}` : fallback;
}

function yamlString(value: string): string {
  if (/^[A-Za-z0-9_./@ -]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function shellSafe(value: string): string {
  return value.replace(/["`$\\]/g, "");
}

function shellArg(value: string): string {
  if (/^[A-Za-z0-9_./@-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

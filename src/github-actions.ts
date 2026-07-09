import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { resolveFreelane } from "./resolve";
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

export interface MigrateGitHubActionsOptions extends GitHubActionsWorkflowOptions {
  cwd?: string;
  dryRun?: boolean;
  force?: boolean;
  jobMap?: Record<string, string>;
  workflow: string;
}

export interface WorkflowAlias {
  job: string;
  alias: string;
}

export interface GitHubActionsMigration {
  changed: boolean;
  content: string;
  routed: MigratedJob[];
  skipped: SkippedJob[];
  workflow: string;
}

export interface MigratedJob {
  alias: string;
  freelaneJob: string;
  runner: string;
  workflowJob: string;
}

export interface SkippedJob {
  reason: string;
  workflowJob: string;
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
    "      - uses: actions/checkout@v7"
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

export function migrateGitHubActionsWorkflow(
  config: FreelaneConfig,
  options: MigrateGitHubActionsOptions
): GitHubActionsMigration {
  const workflow = resolve(options.cwd ?? process.cwd(), options.workflow);
  const raw = readFileSync(workflow, "utf8");
  const migrated = migrateGitHubActionsWorkflowContent(config, raw, options);

  if (migrated.changed && !options.dryRun) {
    writeFileSync(workflow, migrated.content, "utf8");
  }

  return { ...migrated, workflow };
}

export function migrateGitHubActionsWorkflowContent(
  config: FreelaneConfig,
  raw: string,
  options: Omit<MigrateGitHubActionsOptions, "workflow" | "cwd"> = {}
): GitHubActionsMigration {
  const workflow = parse(raw) as Record<string, unknown>;
  if (!isRecord(workflow.jobs)) throw new Error("workflow must define jobs");
  if (workflow.jobs.freelane && !options.force) {
    throw new Error("workflow already has a freelane job; pass --force to replace it");
  }

  const configPath = options.configPath ?? ".freelane.yml";
  const aliases = githubActionsAliases(config);
  const aliasByJob = new Map(aliases.map((alias) => [alias.job, alias.alias]));
  const jobByAlias = new Map(aliases.map((alias) => [alias.alias, alias.job]));
  const jobByRunner = uniqueRunnerMatches(config, aliases);
  const jobs = { ...workflow.jobs };
  const routed: MigratedJob[] = [];
  const skipped: SkippedJob[] = [];
  const routedAliases = new Set<string>();

  delete jobs.freelane;

  for (const [workflowJob, job] of Object.entries(jobs)) {
    if (!isRecord(job)) {
      skipped.push({ workflowJob, reason: "job is not an object" });
      continue;
    }

    const runner = job["runs-on"];
    if (typeof runner !== "string") {
      skipped.push({ workflowJob, reason: "runs-on is not a single string" });
      continue;
    }

    const freelaneJob = matchFreelaneJob(config, workflowJob, runner, options.jobMap ?? {}, jobByAlias, jobByRunner);
    if (!freelaneJob) {
      skipped.push({ workflowJob, reason: "no matching Freelane job" });
      continue;
    }

    const alias = aliasByJob.get(freelaneJob);
    if (!alias) {
      skipped.push({ workflowJob, reason: "matching Freelane job has no alias" });
      continue;
    }

    let needs: string | string[];
    try {
      needs = addNeed(job.needs, "freelane");
    } catch (error) {
      skipped.push({ workflowJob, reason: error instanceof Error ? error.message : String(error) });
      continue;
    }

    jobs[workflowJob] = routedJob(job, needs, `\${{ needs.freelane.outputs.${alias} }}`);
    routed.push({ workflowJob, freelaneJob, alias, runner });
    routedAliases.add(alias);
  }

  if (routed.length === 0) {
    return {
      changed: false,
      content: raw,
      routed,
      skipped,
      workflow: ""
    };
  }

  const routedAliasList = aliases.filter((alias) => routedAliases.has(alias.alias));
  workflow.jobs = {
    freelane: routerJob(routedAliasList, configPath, options.uses),
    ...jobs
  };

  return {
    changed: true,
    content: stringify(workflow, { lineWidth: 0, nullStr: "" }),
    routed,
    skipped,
    workflow: ""
  };
}

function routerJob(aliases: WorkflowAlias[], configPath: string, uses = DEFAULT_ACTION_REF): Record<string, unknown> {
  const outputs: Record<string, string> = {};
  const steps: Array<Record<string, unknown>> = [{ uses: "actions/checkout@v7" }];

  for (const alias of aliases) {
    outputs[alias.alias] = `\${{ steps.${alias.alias}.outputs.label }}`;
    outputs[`${alias.alias}_runs_on`] = `\${{ steps.${alias.alias}.outputs.runs_on }}`;
    outputs[`${alias.alias}_provider`] = `\${{ steps.${alias.alias}.outputs.provider }}`;
    outputs[`${alias.alias}_reason`] = `\${{ steps.${alias.alias}.outputs.reason }}`;
    steps.push({
      id: alias.alias,
      name: `Route ${alias.job}`,
      uses,
      with: {
        config: configPath,
        job: alias.job,
        validate: true
      }
    });
  }

  return {
    name: "Choose runners",
    "runs-on": "ubuntu-latest",
    outputs,
    steps
  };
}

function routedJob(job: Record<string, unknown>, needs: string | string[], runsOn: string): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (job.name !== undefined) next.name = job.name;
  next.needs = needs;
  next["runs-on"] = runsOn;

  for (const [key, value] of Object.entries(job)) {
    if (key !== "name" && key !== "needs" && key !== "runs-on") next[key] = value;
  }

  return next;
}

function matchFreelaneJob(
  config: FreelaneConfig,
  workflowJob: string,
  runner: string,
  explicitMap: Record<string, string>,
  jobByAlias: Map<string, string>,
  jobByRunner: Map<string, string>
): string | undefined {
  const mapped = explicitMap[workflowJob];
  if (mapped && config.jobs[mapped]) return mapped;
  if (config.jobs[workflowJob]) return workflowJob;
  const aliasMatch = jobByAlias.get(sanitizeOutputName(workflowJob));
  if (aliasMatch) return aliasMatch;
  return jobByRunner.get(runner);
}

function uniqueRunnerMatches(config: FreelaneConfig, aliases: WorkflowAlias[]): Map<string, string> {
  const matches = new Map<string, string[]>();

  for (const alias of aliases) {
    const decision = resolveFreelane(config, alias.job);
    if (!decision.label) continue;
    const jobs = matches.get(decision.label) ?? [];
    jobs.push(alias.job);
    matches.set(decision.label, jobs);
  }

  const unique = new Map<string, string>();
  for (const [runner, jobs] of matches) {
    if (jobs.length === 1) unique.set(runner, jobs[0]);
  }
  return unique;
}

function addNeed(existing: unknown, required: string): string | string[] {
  if (existing === undefined) return required;
  if (typeof existing === "string") return existing === required ? existing : [required, existing];
  if (Array.isArray(existing) && existing.every((item) => typeof item === "string")) {
    return existing.includes(required) ? existing : [required, ...existing];
  }
  throw new Error("cannot migrate job with non-string needs");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

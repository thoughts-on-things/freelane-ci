import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isMap, isScalar, parseDocument } from "yaml";
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
    "  actions: read",
    "",
    "jobs:",
    "  freelane:",
    "    name: Choose runners",
    "    runs-on: ubuntu-latest",
    "    outputs:"
  ];

  for (const alias of aliases) {
    lines.push(`      ${alias.alias}: \${{ steps.route.outputs.${alias.alias} }}`);
    if (usesRunnerArray(config, alias.job)) {
      lines.push(`      ${alias.alias}_runs_on: \${{ steps.route.outputs.${alias.alias}_runs_on }}`);
    }
  }

  lines.push(
    "    steps:",
    "      - uses: actions/checkout@v7"
  );

  lines.push(
    "      - id: route",
    "        name: Route workflow jobs",
    `        uses: ${yamlString(uses)}`,
    "        with:",
    `          config: ${yamlString(configPath)}`,
    `          jobs: ${yamlString(JSON.stringify(aliases))}`,
    "          token: ${{ github.token }}",
    "          repository: ${{ github.repository }}",
    "          validate: true"
  );

  for (const alias of aliases) {
    const runsOn = workflowRunsOn(config, alias.job, alias.alias);
    lines.push(
      "",
      `  ${alias.alias}:`,
      `    name: ${yamlString(alias.job)}`,
      "    needs: freelane",
      `    runs-on: ${runsOn}`,
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
  const document = parseDocument(raw, { keepSourceTokens: true });
  if (document.errors.length) throw new Error(`invalid workflow YAML: ${document.errors[0]?.message}`);
  const workflow = document.toJS() as Record<string, unknown>;
  if (!isRecord(workflow.jobs)) throw new Error("workflow must define jobs");
  if (workflow.jobs.freelane && !options.force) {
    throw new Error("workflow already has a freelane job; pass --force to replace it");
  }

  const configPath = options.configPath ?? ".freelane.yml";
  const newline = newlineFor(raw);
  const aliases = githubActionsAliases(config);
  const aliasByJob = new Map(aliases.map((alias) => [alias.job, alias.alias]));
  const jobByAlias = new Map(aliases.map((alias) => [alias.alias, alias.job]));
  const jobByRunner = uniqueRunnerMatches(config, aliases);
  const routed: MigratedJob[] = [];
  const skipped: SkippedJob[] = [];
  const routedAliases = new Set<string>();
  const edits: TextEdit[] = [];
  const jobsNode = document.get("jobs", true);
  if (!isMap(jobsNode)) throw new Error("workflow jobs must be a mapping");

  for (const [workflowJob, freelaneJob] of Object.entries(options.jobMap ?? {})) {
    if (!config.jobs[freelaneJob]) {
      throw new Error(`--job-map ${workflowJob} references unknown Freelane job: ${freelaneJob}`);
    }
  }

  for (const [workflowJob, job] of Object.entries(workflow.jobs)) {
    if (workflowJob === "freelane") continue;
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

    const jobPair = findMapPair(jobsNode, workflowJob);
    if (!jobPair || !isMap(jobPair.value)) {
      skipped.push({ workflowJob, reason: "cannot locate job in YAML source" });
      continue;
    }
    const runsOnPair = findMapPair(jobPair.value, "runs-on");
    const runsOnRange = sourceRange(runsOnPair?.value);
    if (!runsOnPair || !runsOnRange) {
      skipped.push({ workflowJob, reason: "cannot locate runs-on in YAML source" });
      continue;
    }
    edits.push({
      start: runsOnRange[0],
      end: runsOnRange[1],
      text: workflowRunsOn(config, freelaneJob, alias)
    });
    const needsPair = findMapPair(jobPair.value, "needs");
    const needsRange = sourceRange(needsPair?.value);
    if (needsRange) {
      edits.push({
        start: needsRange[0],
        end: needsRange[1],
        text: yamlInline(needs)
      });
    } else if (sourceRange(runsOnPair.key)) {
      const keyStart = sourceRange(runsOnPair.key)![0];
      const start = lineStart(raw, keyStart);
      const indent = raw.slice(start, keyStart);
      edits.push({ start, end: start, text: `${indent}needs: freelane${newline}` });
    }
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
  addPermissionsEdit(document, raw, edits, newline);
  const router = routerJobYaml(config, routedAliasList, configPath, options.uses, newline);
  const existingRouter = findMapPair(jobsNode, "freelane");
  const existingRouterKeyRange = sourceRange(existingRouter?.key);
  const existingRouterValueRange = sourceRange(existingRouter?.value);
  if (existingRouterKeyRange && existingRouterValueRange) {
    const start = lineStart(raw, existingRouterKeyRange[0]);
    edits.push({ start, end: existingRouterValueRange[2] ?? existingRouterValueRange[1], text: router });
  } else {
    const first = jobsNode.items[0];
    const firstKeyRange = sourceRange(first?.key);
    if (!firstKeyRange) throw new Error("workflow jobs mapping is empty");
    const start = lineStart(raw, firstKeyRange[0]);
    edits.push({ start, end: start, text: `${router}${newline}` });
  }

  return {
    changed: true,
    content: applyTextEdits(raw, edits),
    routed,
    skipped,
    workflow: ""
  };
}

interface TextEdit { start: number; end: number; text: string }
type SourceRange = [number, number, number?];
interface SourcePair { key?: unknown; value?: unknown }

function routerJobYaml(
  config: FreelaneConfig,
  aliases: WorkflowAlias[],
  configPath: string,
  uses = DEFAULT_ACTION_REF,
  newline = "\n"
): string {
  const lines = [
    "  freelane:",
    "    name: Choose runners",
    "    runs-on: ubuntu-latest",
    "    outputs:"
  ];
  for (const alias of aliases) {
    lines.push(`      ${alias.alias}: \${{ steps.route.outputs.${alias.alias} }}`);
    if (usesRunnerArray(config, alias.job)) {
      lines.push(`      ${alias.alias}_runs_on: \${{ steps.route.outputs.${alias.alias}_runs_on }}`);
    }
  }
  lines.push(
    "    steps:",
    "      - uses: actions/checkout@v7",
    "      - id: route",
    "        name: Route workflow jobs",
    `        uses: ${yamlString(uses)}`,
    "        with:",
    `          config: ${yamlString(configPath)}`,
    `          jobs: ${yamlString(JSON.stringify(aliases))}`,
    "          token: ${{ github.token }}",
    "          repository: ${{ github.repository }}",
    "          validate: true",
    ""
  );
  return lines.join(newline);
}

function findMapPair(map: { items: unknown[] }, key: string): SourcePair | undefined {
  return map.items.find((item) => {
    const pair = item as SourcePair;
    return isScalar(pair.key) && String(pair.key.value) === key;
  }) as SourcePair | undefined;
}

function sourceRange(value: unknown): SourceRange | undefined {
  if (!value || typeof value !== "object" || !("range" in value)) return undefined;
  return (value as { range?: SourceRange }).range;
}

function addPermissionsEdit(
  document: ReturnType<typeof parseDocument>,
  raw: string,
  edits: TextEdit[],
  newline: string
): void {
  const permissions = document.get("permissions", true);
  if (isMap(permissions)) {
    if (findMapPair(permissions, "actions")) return;
    if (permissions.flow) {
      const range = sourceRange(permissions);
      if (!range) return;
      const close = raw.lastIndexOf("}", range[1]);
      let insert = close;
      while (insert > range[0] && /\s/.test(raw[insert - 1]!)) insert -= 1;
      if (close >= range[0]) edits.push({ start: insert, end: insert, text: `${permissions.items.length ? ", " : ""}actions: read` });
      return;
    }
    const last = permissions.items.at(-1);
    const valueRange = sourceRange(last?.value);
    const keyRange = sourceRange(last?.key);
    if (!valueRange || !keyRange) return;
    const end = valueRange[2] ?? valueRange[1];
    const start = lineStart(raw, keyRange[0]);
    const indent = raw.slice(start, keyRange[0]);
    edits.push({ start: end, end, text: `${indent}actions: read${newline}` });
    return;
  }
  if (permissions !== undefined) return;
  const root = document.contents;
  if (!isMap(root)) return;
  const jobsPair = findMapPair(root, "jobs");
  const jobsKeyRange = sourceRange(jobsPair?.key);
  if (!jobsKeyRange) return;
  const start = lineStart(raw, jobsKeyRange[0]);
  edits.push({
    start,
    end: start,
    text: `permissions:${newline}  contents: read${newline}  actions: read${newline}${newline}`
  });
}

function applyTextEdits(raw: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((left, right) => right.start - left.start || right.end - left.end);
  let output = raw;
  let boundary = raw.length + 1;
  for (const edit of sorted) {
    if (edit.end > boundary) throw new Error("overlapping workflow edits");
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    boundary = edit.start;
  }
  return output;
}

function lineStart(raw: string, offset: number): number {
  return raw.lastIndexOf("\n", offset - 1) + 1;
}

function newlineFor(raw: string): string {
  return raw.includes("\r\n") ? "\r\n" : "\n";
}

function yamlInline(value: string | string[]): string {
  return typeof value === "string" ? yamlString(value) : JSON.stringify(value);
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

function workflowRunsOn(config: FreelaneConfig, job: string, alias: string): string {
  if (usesRunnerArray(config, job)) {
    return `\${{ fromJSON(needs.freelane.outputs.${alias}_runs_on) }}`;
  }
  return `\${{ needs.freelane.outputs.${alias} }}`;
}

function usesRunnerArray(config: FreelaneConfig, job: string): boolean {
  const jobConfig = config.jobs[job];
  const providerIds = jobConfig.providers ?? Object.keys(config.providers);
  return Array.isArray(jobConfig.runner)
    || providerIds.some((provider) => Array.isArray(config.providers[provider]?.runner));
}

export function sanitizeOutputName(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_/, "")
    .replace(/_$/, "");
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

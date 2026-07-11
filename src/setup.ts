import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { CONFIG_SCHEMA_URL } from "./constants";
import { migrateGitHubActionsWorkflowContent, sanitizeOutputName } from "./github-actions";
import type { FreelaneConfig, JobConfig, ProviderConfig, RunnerArch, RunnerOs } from "./types";

const SUPPORTED_PROVIDERS = ["github", "blacksmith"] as const;
export type GitHubPlan = "public" | "free" | "pro" | "team" | "enterprise";

export interface SetupGitHubActionsOptions {
  configPath?: string;
  cwd?: string;
  force?: boolean;
  githubMinutes?: number;
  githubPlan?: GitHubPlan;
  providers?: string[];
  uses?: string;
  workflows: string[];
}

export interface SetupGitHubActionsResult {
  config: string;
  jobs: number;
  skipped: Array<{ reason: string; workflowJob: string; workflow: string }>;
  workflows: Array<{ path: string; routed: number }>;
}

interface DiscoveredWorkflow {
  path: string;
  raw: string;
  jobs: Array<{ id: string; config: JobConfig }>;
  skipped: Array<{ reason: string; workflowJob: string }>;
}

export function setupGitHubActions(options: SetupGitHubActionsOptions): SetupGitHubActionsResult {
  if (options.workflows.length === 0) throw new Error("at least one --workflow is required");
  if (options.githubMinutes !== undefined && options.githubPlan !== undefined) {
    throw new Error("use either --github-plan or --github-minutes, not both");
  }
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configPath ?? ".freelane.yml");
  if (existsSync(configPath) && !options.force) {
    throw new Error(`${configPath} already exists; use migrate for an existing config or pass --force to replace it`);
  }

  const providers = normalizeProviders(options.providers);
  const discovered = options.workflows.map((workflow) => discoverWorkflow(resolve(cwd, workflow)));
  const config = buildDiscoveredConfig(discovered, providers, githubMinutesFor(options));
  const migrations = discovered.map((workflow) => {
    const jobMap = Object.fromEntries(workflow.jobs.map((job) => [job.id, configKey(workflow.path, job.id, discovered)]));
    const migration = migrateGitHubActionsWorkflowContent(config, workflow.raw, {
      configPath: relativeConfigPath(cwd, configPath),
      force: options.force,
      jobMap,
      uses: options.uses
    });
    return { workflow, migration };
  });

  if (migrations.every(({ migration }) => !migration.changed)) {
    throw new Error("no routable jobs found; setup supports literal GitHub or Blacksmith runs-on labels");
  }

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, stringify({ $schema: CONFIG_SCHEMA_URL, ...config }, { lineWidth: 0 }), "utf8");
  for (const { workflow, migration } of migrations) {
    if (migration.changed) writeFileSync(workflow.path, migration.content, "utf8");
  }

  return {
    config: configPath,
    jobs: Object.keys(config.jobs).length,
    skipped: discovered.flatMap((workflow) => workflow.skipped.map((job) => ({ ...job, workflow: workflow.path }))),
    workflows: migrations.map(({ workflow, migration }) => ({ path: workflow.path, routed: migration.routed.length }))
  };
}

function discoverWorkflow(path: string): DiscoveredWorkflow {
  const raw = readFileSync(path, "utf8");
  const workflow = parse(raw) as Record<string, unknown>;
  if (!isRecord(workflow.jobs)) throw new Error(`${path} must define jobs`);
  const jobs: DiscoveredWorkflow["jobs"] = [];
  const skipped: DiscoveredWorkflow["skipped"] = [];

  for (const [id, value] of Object.entries(workflow.jobs)) {
    if (id === "freelane") continue;
    if (!isRecord(value) || typeof value["runs-on"] !== "string") {
      skipped.push({ workflowJob: id, reason: "runs-on is not a literal string" });
      continue;
    }
    const config = jobConfigFromRunner(value["runs-on"]);
    if (!config) {
      skipped.push({ workflowJob: id, reason: `unsupported runner: ${value["runs-on"]}` });
      continue;
    }
    jobs.push({ id, config });
  }
  return { path, raw, jobs, skipped };
}

function buildDiscoveredConfig(workflows: DiscoveredWorkflow[], providerIds: string[], githubMinutes: number | undefined): FreelaneConfig {
  const providers: Record<string, ProviderConfig> = {};
  for (const provider of providerIds) {
    providers[provider] = provider === "blacksmith"
      ? { enabled: true, free_minutes_per_month: 3000 }
      : githubMinutes === undefined ? { enabled: true } : { enabled: true, free_minutes_per_month: githubMinutes };
  }

  const jobs: Record<string, JobConfig> = {};
  for (const workflow of workflows) {
    for (const job of workflow.jobs) {
      const key = configKey(workflow.path, job.id, workflows);
      jobs[key] = { ...job.config, providers: [...providerIds] };
    }
  }
  return {
    version: 1,
    defaults: {
      paid: "avoid",
      fallback: { mode: "pre_schedule", providers: paidFallbackProviders(providerIds) }
    },
    providers,
    jobs
  };
}

function githubMinutesFor(options: SetupGitHubActionsOptions): number | undefined {
  if (options.githubMinutes !== undefined) return options.githubMinutes;
  if (options.githubPlan === "public") return undefined;
  if (options.githubPlan === "free") return 2000;
  if (options.githubPlan === "pro" || options.githubPlan === "team") return 3000;
  if (options.githubPlan === "enterprise") return 50000;
  return 0;
}

function paidFallbackProviders(providerIds: string[]): string[] {
  return providerIds.includes("github") ? ["github"] : providerIds;
}

function configKey(path: string, id: string, workflows: DiscoveredWorkflow[]): string {
  const duplicates = workflows.filter((workflow) => workflow.jobs.some((job) => job.id === id));
  if (duplicates.length <= 1) return id;
  const stem = basename(path, extname(path));
  return `${sanitizeOutputName(stem)}-${id}`;
}

function jobConfigFromRunner(runner: string): JobConfig | undefined {
  const blacksmith = /^blacksmith-(\d+)vcpu-(ubuntu-(?:2204|2404)(-arm)?|windows-2025|macos-(?:latest|\d+))$/.exec(runner);
  if (blacksmith) {
    const platform = blacksmith[2];
    return {
      os: platform.startsWith("ubuntu") ? "linux" : platform.startsWith("windows") ? "windows" : "macos",
      arch: platform.endsWith("-arm") || platform.startsWith("macos") ? "arm64" : "x64",
      min_vcpu: Number(blacksmith[1]),
      estimate_minutes: 10
    };
  }
  const github = /^(ubuntu|windows|macos)-(?:latest|\d+(?:\.\d+)?)(-arm)?$/.exec(runner);
  if (!github) return undefined;
  const os: RunnerOs = github[1] === "ubuntu" ? "linux" : github[1] as RunnerOs;
  const arch: RunnerArch = github[2] || os === "macos" ? "arm64" : "x64";
  return { os, arch, min_vcpu: 2, estimate_minutes: 10 };
}

function normalizeProviders(values: string[] | undefined): string[] {
  const providers = values?.length ? [...new Set(values.flatMap((value) => value.split(",")).filter(Boolean))] : [...SUPPORTED_PROVIDERS];
  if (providers.length === 0) throw new Error("at least one provider is required");
  const unsupported = providers.filter((provider) => !SUPPORTED_PROVIDERS.includes(provider as typeof SUPPORTED_PROVIDERS[number]));
  if (unsupported.length) throw new Error(`setup currently supports providers: ${SUPPORTED_PROVIDERS.join(", ")}; unsupported: ${unsupported.join(", ")}`);
  return providers;
}

function relativeConfigPath(cwd: string, configPath: string): string {
  return relative(cwd, configPath).replace(/\\/g, "/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

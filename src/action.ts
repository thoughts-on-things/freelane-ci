import * as core from "@actions/core";
import { loadConfig } from "./config";
import { collectGitHubUsage } from "./github-usage";
import { planFreelane } from "./plan";
import { displayUnit, roundQuota } from "./quota";
import { resolveFreelane } from "./resolve";
import { formatValidation, validateConfigFile } from "./schema";
import type { FreelaneConfig, RoutingDecision } from "./types";
import { applyUsageState } from "./usage-state";

interface BatchJob {
  alias: string;
  job: string;
}

export async function run(): Promise<void> {
  const jobsInput = core.getInput("jobs");
  const job = core.getInput("job", { required: !jobsInput });
  const configPath = core.getInput("config") || ".freelane.yml";
  const shouldValidate = core.getBooleanInput("validate");

  if (shouldValidate) {
    const validation = validateConfigFile(configPath);
    if (!validation.valid) throw new Error(formatValidation(validation, "text").trim());
  }

  const config = await configWithLiveUsage(loadConfig(configPath));
  if (jobsInput) {
    const jobs = parseBatchJobs(jobsInput);
    const plan = planFreelane(config, jobs.map((item) => item.job));
    for (const [index, item] of jobs.entries()) setBatchOutputs(item.alias, plan.decisions[index]!);
    logBatch(plan.decisions);
    for (const decision of plan.decisions) warnIfPaid(config, decision);
    await writeSummary(config, plan.decisions);
    return;
  }

  const decision = resolveFreelane(config, job);
  setLegacyOutputs(decision);
  logDecision(decision);
  warnIfPaid(config, decision);
  await writeSummary(config, [decision]);
}

async function configWithLiveUsage(config: FreelaneConfig): Promise<FreelaneConfig> {
  const token = core.getInput("token");
  const repo = core.getInput("repository") || process.env.GITHUB_REPOSITORY;
  const syncUsage = core.getInput("sync_usage") !== "false";
  if (!syncUsage || !token || !repo) return config;

  try {
    const now = new Date();
    const state = await collectGitHubUsage({
      repo,
      token,
      since: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      limit: positiveIntegerInput("history_limit", 100),
      now
    });
    core.info(`Learned routing state from ${state.jobCount} completed jobs across ${state.runCount} runs.`);
    return applyUsageState(config, state);
  } catch (error) {
    core.warning(`Could not sync live usage; routing with configured state: ${error instanceof Error ? error.message : String(error)}`);
    return config;
  }
}

function parseBatchJobs(value: string): BatchJob[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("jobs must be a non-empty JSON array");
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("each jobs entry must be an object");
    const { job, alias } = item as Record<string, unknown>;
    if (typeof job !== "string" || !job || typeof alias !== "string" || !/^[a-z_][a-z0-9_]*$/.test(alias)) {
      throw new Error("each jobs entry requires a job and safe output alias");
    }
    return { job, alias };
  });
}

function setLegacyOutputs(decision: RoutingDecision): void {
  core.setOutput("runs_on", decision.runsOnJson);
  core.setOutput("label", decision.label ?? "");
  core.setOutput("provider", decision.provider);
  core.setOutput("runner", JSON.stringify(decision.runner));
  core.setOutput("reason", decision.reason);
}

function setBatchOutputs(alias: string, decision: RoutingDecision): void {
  core.setOutput(alias, decision.label ?? "");
  core.setOutput(`${alias}_runs_on`, decision.runsOnJson);
  core.setOutput(`${alias}_provider`, decision.provider);
  core.setOutput(`${alias}_reason`, decision.reason);
}

function logBatch(decisions: RoutingDecision[]): void {
  core.startGroup("Freelane workflow plan");
  for (const decision of decisions) {
    core.info(`${decision.job}: ${decision.provider} ${decision.runsOnJson} (${decision.reason})`);
  }
  core.endGroup();
}

function logDecision(decision: RoutingDecision): void {
  core.startGroup("Freelane route");
  core.info(`Job: ${decision.job}`);
  core.info(`Provider: ${decision.provider}`);
  core.info(`Runner: ${decision.runsOnJson}`);
  core.info(`Burn: ${formatQuota(decision.quotaBurn, decision.quotaUnit)}`);
  core.info(`Available: ${formatQuota(decision.available, decision.quotaUnit)}`);
  core.info(`Reason: ${decision.reason}`);
  core.endGroup();
}

function warnIfPaid(config: FreelaneConfig, decision: RoutingDecision): void {
  if (config.defaults?.alerts?.github_warning && decision.paidRequired) {
    core.warning(`Freelane selected ${decision.provider} outside configured free quota.`);
  }
}

async function writeSummary(config: FreelaneConfig, decisions: RoutingDecision[]): Promise<void> {
  if (!decisions.length || config.defaults?.alerts?.github_summary === false) return;
  await core.summary
    .addHeading("Freelane CI")
    .addTable([
      [
        { data: "Job", header: true },
        { data: "Provider", header: true },
        { data: "Runner", header: true },
        { data: "Burn", header: true },
        { data: "Reason", header: true }
      ],
      ...decisions.map((decision) => [
        decision.job,
        decision.provider,
        decision.runsOnJson,
        formatQuota(decision.quotaBurn, decision.quotaUnit),
        decision.reason
      ])
    ])
    .write();
}

function positiveIntegerInput(name: string, fallback: number): number {
  const value = core.getInput(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function formatQuota(value: number, unit: RoutingDecision["quotaUnit"]): string {
  if (unit === "unlimited") return "unlimited";
  return `${roundQuota(value)} ${displayUnit(unit)}`;
}

if (process.env.NODE_ENV !== "test") {
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}

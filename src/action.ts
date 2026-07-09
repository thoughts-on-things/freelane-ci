import * as core from "@actions/core";
import { loadConfig } from "./config";
import { displayUnit, roundQuota } from "./quota";
import { resolveFreelane } from "./resolve";
import { formatValidation, validateConfigFile } from "./schema";
import type { RoutingDecision } from "./types";

async function run(): Promise<void> {
  const job = core.getInput("job", { required: true });
  const configPath = core.getInput("config") || ".freelane.yml";
  const shouldValidate = core.getBooleanInput("validate");

  if (shouldValidate) {
    const validation = validateConfigFile(configPath);
    if (!validation.valid) throw new Error(formatValidation(validation, "text").trim());
  }

  const config = loadConfig(configPath);
  const decision = resolveFreelane(config, job);

  core.setOutput("runs_on", decision.runsOnJson);
  core.setOutput("label", decision.label ?? "");
  core.setOutput("provider", decision.provider);
  core.setOutput("runner", JSON.stringify(decision.runner));
  core.setOutput("reason", decision.reason);

  logDecision(decision);

  if (config.defaults?.alerts?.github_warning && decision.paidRequired) {
    core.warning(`Freelane selected ${decision.provider} outside configured free quota.`);
  }

  if (config.defaults?.alerts?.github_summary !== false) {
    await core.summary
      .addHeading("Freelane CI")
      .addTable([
        [{ data: "Job", header: true }, decision.job],
        [{ data: "Provider", header: true }, decision.provider],
        [{ data: "Runner", header: true }, decision.runsOnJson],
        [{ data: "Burn", header: true }, formatQuota(decision.quotaBurn, decision.quotaUnit)],
        [{ data: "Available", header: true }, formatQuota(decision.available, decision.quotaUnit)],
        [{ data: "Reason", header: true }, decision.reason]
      ])
      .write();
  }
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

function formatQuota(value: number, unit: RoutingDecision["quotaUnit"]): string {
  if (unit === "unlimited") return "unlimited";
  return `${roundQuota(value)} ${displayUnit(unit)}`;
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});

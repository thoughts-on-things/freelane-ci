import * as core from "@actions/core";
import { loadConfig } from "./config";
import { resolveFreelane } from "./resolve";
import { formatValidation, validateConfigFile } from "./schema";

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

  if (config.defaults?.alerts?.github_warning && decision.paidRequired) {
    core.warning(`Freelane selected ${decision.provider} outside configured free quota.`);
  }

  if (config.defaults?.alerts?.github_summary !== false) {
    await core.summary
      .addHeading("Freelane CI")
      .addTable([
        [{ data: "Provider", header: true }, decision.provider],
        [{ data: "Runner", header: true }, decision.runsOnJson],
        [{ data: "Reason", header: true }, decision.reason]
      ])
      .write();
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});

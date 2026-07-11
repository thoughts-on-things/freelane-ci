#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/config.ts
var import_node_fs = require("fs");
var import_node_path = require("path");
var import_yaml = require("yaml");
var DEFAULT_CONFIGS = [".freelane.yml", ".freelane.yaml", "freelane.yml", "freelane.yaml"];
function findConfigPath(cwd = process.cwd()) {
  for (const name of DEFAULT_CONFIGS) {
    const candidate = (0, import_node_path.resolve)(cwd, name);
    if ((0, import_node_fs.existsSync)(candidate)) return candidate;
  }
  return (0, import_node_path.resolve)(cwd, ".freelane.yml");
}
function loadConfig(path = findConfigPath()) {
  const raw = (0, import_node_fs.readFileSync)(path, "utf8");
  const config = (0, import_yaml.parse)(raw);
  validateConfig(config, path);
  return config;
}
function validateConfig(config, path) {
  if (!config || config.version !== 1) {
    throw new Error(`${path}: expected version: 1`);
  }
  if (!isRecord(config.providers)) {
    throw new Error(`${path}: providers must be an object`);
  }
  if (!isRecord(config.jobs)) {
    throw new Error(`${path}: jobs must be an object`);
  }
  for (const [id, provider] of Object.entries(config.providers)) {
    validateProvider(path, id, provider);
  }
  for (const [id, job] of Object.entries(config.jobs)) {
    validateJob(path, id, job);
  }
}
function validateProvider(path, id, provider) {
  if (!isRecord(provider)) {
    throw new Error(`${path}: providers.${id} must be an object`);
  }
}
function validateJob(path, id, job) {
  if (!isRecord(job)) {
    throw new Error(`${path}: jobs.${id} must be an object`);
  }
  if (!["linux", "windows", "macos"].includes(job.os)) {
    throw new Error(`${path}: jobs.${id}.os must be linux, windows, or macos`);
  }
  if (job.arch && !["x64", "arm64"].includes(job.arch)) {
    throw new Error(`${path}: jobs.${id}.arch must be x64 or arm64`);
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/quota.ts
function quotaFor(provider, unit, reserve = 0) {
  const quota = rawQuotaFor(provider, unit);
  return {
    ...quota,
    available: quota.total - quota.used - reserve
  };
}
function rawQuotaFor(provider, unit) {
  if (provider.free_credit_usd_per_month !== void 0) {
    return { total: provider.free_credit_usd_per_month, used: provider.used_credit_usd ?? 0 };
  }
  if (provider.free_minutes_per_month !== void 0) {
    return { total: provider.free_minutes_per_month, used: provider.used_minutes ?? 0 };
  }
  if (provider.unit_minutes_per_month !== void 0 || unit === "unit_minutes") {
    return { total: provider.unit_minutes_per_month ?? 0, used: provider.used_unit_minutes ?? 0 };
  }
  return { total: Number.POSITIVE_INFINITY, used: 0 };
}
function quotaUnitForProvider(provider, fallback = "unlimited") {
  if (provider.free_credit_usd_per_month !== void 0) return "usd";
  if (provider.free_minutes_per_month !== void 0) return "minutes";
  if (provider.unit_minutes_per_month !== void 0) return "unit_minutes";
  return fallback;
}
function displayUnit(unit) {
  if (unit === "usd") return "usd";
  if (unit === "unit_minutes") return "unit-min";
  if (unit === "minutes") return "min";
  return "unlimited";
}
function roundQuota(value) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e4) / 1e4;
}

// src/providers.ts
var VCPU_SIZES = [2, 4, 8, 16, 32];
var providerFactories = {
  github: githubRunner,
  blacksmith: blacksmithRunner,
  ubicloud: ubicloudRunner,
  warpbuild: warpbuildRunner,
  namespace: namespaceRunner
};
function getRunnerOption(providerId, provider, job) {
  if (provider.runner) {
    return option(providerId, provider.runner, job.min_vcpu ?? 2, priceFor(providerId, job), job, quotaUnitForProvider(provider));
  }
  const factory = providerFactories[providerId];
  return factory?.(provider, job);
}
function githubRunner(_provider, job) {
  const arch = job.arch ?? "x64";
  const label = githubLabel(job.os, arch);
  if (!label) return void 0;
  return option("github", label, job.min_vcpu ?? 2, void 0, job, quotaUnitForProvider(_provider));
}
function blacksmithRunner(provider, job) {
  const arch = job.arch ?? "x64";
  const vcpu = nearestVcpu(job.min_vcpu);
  const quotaUnit = quotaUnitForProvider(provider);
  if (job.os === "linux" && arch === "x64") {
    return option("blacksmith", `blacksmith-${vcpu}vcpu-ubuntu-2404`, vcpu, priceFor("blacksmith", job), job, quotaUnit);
  }
  if (job.os === "linux" && arch === "arm64") {
    return option("blacksmith", `blacksmith-${vcpu}vcpu-ubuntu-2404-arm`, vcpu, priceFor("blacksmith", job), job, quotaUnit);
  }
  if (job.os === "windows" && arch === "x64") {
    return option("blacksmith", `blacksmith-${vcpu}vcpu-windows-2025`, vcpu, priceFor("blacksmith", job), job, quotaUnit);
  }
  if (job.os === "macos" && arch === "arm64") {
    const macVcpu = job.min_vcpu && job.min_vcpu > 6 ? 12 : 6;
    return option("blacksmith", `blacksmith-${macVcpu}vcpu-macos-15`, macVcpu, priceFor("blacksmith", job), job, quotaUnit);
  }
  return void 0;
}
function ubicloudRunner(provider, job) {
  const arch = job.arch ?? "x64";
  const vcpu = nearestVcpu(job.min_vcpu, [2, 4, 8, 16, 30]);
  const quotaUnit = quotaUnitForProvider(provider);
  if (job.os !== "linux") return void 0;
  if (arch === "x64") {
    return option("ubicloud", `ubicloud-standard-${vcpu}`, vcpu, priceFor("ubicloud", job), job, quotaUnit);
  }
  return option("ubicloud", `ubicloud-standard-${vcpu}-arm`, vcpu, priceFor("ubicloud", job), job, quotaUnit);
}
function warpbuildRunner(provider, job) {
  const arch = job.arch ?? "x64";
  const vcpu = nearestVcpu(job.min_vcpu);
  const quotaUnit = quotaUnitForProvider(provider);
  if (job.os === "linux") {
    return option("warpbuild", `warp-ubuntu-latest-${arch}-${vcpu}x`, vcpu, priceFor("warpbuild", job), job, quotaUnit);
  }
  if (job.os === "windows" && arch === "x64") {
    const winVcpu = nearestVcpu(job.min_vcpu, [4, 8, 16, 32]);
    return option("warpbuild", `warp-windows-latest-x64-${winVcpu}x`, winVcpu, priceFor("warpbuild", job), job, quotaUnit);
  }
  if (job.os === "macos" && arch === "arm64") {
    const macVcpu = job.min_vcpu && job.min_vcpu > 6 ? 12 : 6;
    return option("warpbuild", `warp-macos-latest-arm64-${macVcpu}x`, macVcpu, priceFor("warpbuild", job), job, quotaUnit);
  }
  return void 0;
}
function namespaceRunner(provider, job) {
  if (provider.profile) {
    return option("namespace", `namespace-profile-${provider.profile}`, job.min_vcpu ?? 4, void 0, job, quotaUnitForProvider(provider));
  }
  const arch = job.arch === "arm64" ? "arm64" : "amd64";
  const os = namespaceOs(job.os);
  if (!os) return void 0;
  const sizes = job.os === "macos" ? [6, 12] : [2, 4, 8, 16, 32];
  const vcpu = nearestVcpu(job.min_vcpu, sizes);
  const memory = job.os === "macos" ? vcpu === 12 ? 28 : 14 : vcpu * 2;
  return option("namespace", `nscloud-${os}-${arch}-${vcpu}x${memory}`, vcpu, void 0, job, quotaUnitForProvider(provider, "unit_minutes"));
}
function option(provider, runner, vcpu, unitPriceUsd, job, quotaUnit) {
  const minutes = job.estimate_minutes ?? 10;
  const quotaBurn = quotaUnit === "unlimited" ? 0 : quotaUnit === "usd" ? minutes * (unitPriceUsd ?? 0) : unitBurn(provider, job.os, vcpu, minutes);
  return { provider, runner, vcpu, unitPriceUsd, quotaBurn, quotaUnit };
}
function unitBurn(provider, os, vcpu, minutes) {
  if (provider === "namespace") return vcpu * minutes * platformMultiplier(os);
  if (provider === "github" || provider === "blacksmith") return Math.max(1, vcpu / 2) * minutes * platformMultiplier(os);
  return minutes;
}
function platformMultiplier(os) {
  if (os === "windows") return 2;
  if (os === "macos") return 10;
  return 1;
}
function priceFor(provider, job) {
  const arch = job.arch ?? "x64";
  if (provider === "blacksmith") {
    if (job.os === "linux" && arch === "arm64") return 25e-4;
    if (job.os === "windows") return 8e-3;
    if (job.os === "macos") return 0.08;
    return 4e-3;
  }
  if (provider === "ubicloud") {
    return arch === "arm64" ? 1e-3 : 16e-4;
  }
  if (provider === "warpbuild") {
    if (job.os === "linux" && arch === "arm64") return 3e-3;
    if (job.os === "windows") return 8e-3;
    if (job.os === "macos") return 0.08;
    return 4e-3;
  }
  return void 0;
}
function githubLabel(os, arch) {
  if (os === "linux" && arch === "x64") return "ubuntu-latest";
  if (os === "linux" && arch === "arm64") return "ubuntu-24.04-arm";
  if (os === "windows" && arch === "x64") return "windows-latest";
  if (os === "macos") return "macos-latest";
  return void 0;
}
function namespaceOs(os) {
  if (os === "linux") return "ubuntu-24.04";
  if (os === "windows") return "windows-2022";
  if (os === "macos") return "macos-sequoia";
  return void 0;
}
function nearestVcpu(min = 2, sizes = VCPU_SIZES) {
  return sizes.find((size) => size >= min) ?? sizes[sizes.length - 1];
}

// src/doctor.ts
function doctorConfig(config) {
  const entries = [];
  for (const [jobId, job] of Object.entries(config.jobs)) {
    const providerIds = job.providers ?? Object.keys(config.providers);
    for (const providerId of providerIds) {
      const provider = config.providers[providerId];
      if (!provider) {
        entries.push({ job: jobId, provider: providerId, status: "missing", message: "provider is not configured" });
        continue;
      }
      if (provider.enabled === false) {
        entries.push({ job: jobId, provider: providerId, status: "disabled", message: "provider is disabled" });
        continue;
      }
      const option2 = getRunnerOption(providerId, provider, job);
      if (!option2) {
        entries.push({ job: jobId, provider: providerId, status: "unsupported", message: "no runner matches job requirements" });
        continue;
      }
      const reserve = config.defaults?.reserve?.[providerId] ?? 0;
      const quota = quotaFor(provider, option2.quotaUnit, reserve);
      const quotaBurn = roundQuota(option2.quotaBurn);
      const available = roundQuota(quota.available);
      const status = quota.total !== Number.POSITIVE_INFINITY && quota.available < option2.quotaBurn ? "quota-low" : "ok";
      const unit = displayUnit(option2.quotaUnit);
      entries.push({
        job: jobId,
        provider: providerId,
        status,
        runner: option2.runner,
        quotaUnit: option2.quotaUnit,
        quotaBurn,
        available,
        message: status === "ok" ? `burns ${quotaBurn} ${unit}; ${available} available` : `needs ${quotaBurn} ${unit}; ${available} available`
      });
    }
  }
  return { entries };
}
function formatDoctor(report, format) {
  if (format === "json") return `${JSON.stringify(report, null, 2)}
`;
  return report.entries.map((entry) => {
    const runner = entry.runner ? JSON.stringify(entry.runner) : "-";
    return `${entry.status}	${entry.job}	${entry.provider}	${runner}	${entry.message}`;
  }).join("\n") + "\n";
}

// src/format.ts
function formatDecision(decision2, format) {
  if (format === "json") return `${JSON.stringify(decision2, null, 2)}
`;
  if (format === "github-output") {
    return [
      `runs_on=${decision2.runsOnJson}`,
      `label=${decision2.label ?? ""}`,
      `provider=${decision2.provider}`,
      `runner=${JSON.stringify(decision2.runner)}`,
      `reason=${decision2.reason}`
    ].join("\n") + "\n";
  }
  return `${decision2.provider} ${decision2.runsOnJson} - ${decision2.reason}
`;
}

// src/github-actions.ts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
var import_yaml2 = require("yaml");

// src/resolve.ts
function resolveFreelane(config, jobId) {
  const job = config.jobs[jobId];
  if (!job) throw new Error(`unknown job: ${jobId}`);
  if (job.runner) {
    return directDecision(jobId, job);
  }
  const providerIds = job.providers ?? Object.keys(config.providers);
  const candidates = providerIds.map((id) => candidateFor(config, id, job)).filter((candidate) => Boolean(candidate));
  if (candidates.length === 0) {
    throw new Error(`no enabled provider can satisfy job: ${jobId}`);
  }
  const free = candidates.find((candidate) => !candidate.paidRequired);
  if (free) return decision(jobId, free, `selected ${free.option.provider} within configured free quota`);
  const fallback = fallbackCandidate(config, job, candidates);
  if (fallback) return decision(jobId, fallback, `fallback to ${fallback.option.provider}; free quota unavailable`);
  const paid = config.defaults?.paid ?? "avoid";
  if (paid === "forbid") {
    throw new Error(`free quota unavailable for job: ${jobId}`);
  }
  return decision(jobId, candidates[0], `selected ${candidates[0].option.provider}; free quota unavailable`);
}
function candidateFor(config, providerId, job) {
  const provider = config.providers[providerId];
  if (!provider || provider.enabled === false) return void 0;
  const option2 = getRunnerOption(providerId, provider, job);
  if (!option2) return void 0;
  const reserve = config.defaults?.reserve?.[providerId] ?? 0;
  const quota = quotaFor(provider, option2.quotaUnit, reserve);
  const available = quota.available;
  const paidRequired = quota.total !== Number.POSITIVE_INFINITY && available < option2.quotaBurn;
  return { option: option2, available, paidRequired };
}
function fallbackCandidate(config, job, candidates) {
  const fallbackIds = config.defaults?.fallback?.providers ?? [];
  for (const id of fallbackIds) {
    const existing = candidates.find((candidate) => candidate.option.provider === id);
    if (existing) return existing;
    const fallback = candidateFor(config, id, job);
    if (fallback) return fallback;
  }
  return void 0;
}
function decision(jobId, candidate, reason) {
  const runner = candidate.option.runner;
  return {
    job: jobId,
    provider: candidate.option.provider,
    runner,
    label: typeof runner === "string" ? runner : void 0,
    runsOnJson: JSON.stringify(runner),
    reason,
    paidRequired: candidate.paidRequired,
    quotaUnit: candidate.option.quotaUnit,
    quotaBurn: roundQuota(candidate.option.quotaBurn),
    available: roundQuota(candidate.available)
  };
}
function directDecision(jobId, job) {
  const runner = job.runner ?? "ubuntu-latest";
  return {
    job: jobId,
    provider: "manual",
    runner,
    label: typeof runner === "string" ? runner : void 0,
    runsOnJson: JSON.stringify(runner),
    reason: "selected job-specific runner",
    paidRequired: false,
    quotaUnit: "unlimited",
    quotaBurn: 0,
    available: Number.POSITIVE_INFINITY
  };
}

// src/github-actions.ts
var DEFAULT_WORKFLOW_OUTPUT = ".github/workflows/freelane-ci.yml";
var DEFAULT_ACTION_REF = "thoughts-on-things/freelane-ci@v0";
function githubActionsAliases(config) {
  const seen = /* @__PURE__ */ new Map();
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
function generateGitHubActionsWorkflow(config, options = {}) {
  const aliases = githubActionsAliases(config);
  const configPath = options.configPath ?? ".freelane.yml";
  const uses = options.uses ?? DEFAULT_ACTION_REF;
  const workflowName = options.workflowName ?? "Freelane CI";
  const lines = [
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
function writeGitHubActionsWorkflow(config, options = {}) {
  const output = (0, import_node_path2.resolve)(options.cwd ?? process.cwd(), options.output ?? DEFAULT_WORKFLOW_OUTPUT);
  if ((0, import_node_fs2.existsSync)(output) && !options.force) {
    throw new Error(`${output} already exists; pass --force to overwrite`);
  }
  (0, import_node_fs2.mkdirSync)((0, import_node_path2.dirname)(output), { recursive: true });
  (0, import_node_fs2.writeFileSync)(output, generateGitHubActionsWorkflow(config, options), "utf8");
  return output;
}
function migrateGitHubActionsWorkflow(config, options) {
  const workflow = (0, import_node_path2.resolve)(options.cwd ?? process.cwd(), options.workflow);
  const raw = (0, import_node_fs2.readFileSync)(workflow, "utf8");
  const migrated = migrateGitHubActionsWorkflowContent(config, raw, options);
  if (migrated.changed && !options.dryRun) {
    (0, import_node_fs2.writeFileSync)(workflow, migrated.content, "utf8");
  }
  return { ...migrated, workflow };
}
function migrateGitHubActionsWorkflowContent(config, raw, options = {}) {
  const workflow = (0, import_yaml2.parse)(raw);
  if (!isRecord2(workflow.jobs)) throw new Error("workflow must define jobs");
  if (workflow.jobs.freelane && !options.force) {
    throw new Error("workflow already has a freelane job; pass --force to replace it");
  }
  const configPath = options.configPath ?? ".freelane.yml";
  const aliases = githubActionsAliases(config);
  const aliasByJob = new Map(aliases.map((alias) => [alias.job, alias.alias]));
  const jobByAlias = new Map(aliases.map((alias) => [alias.alias, alias.job]));
  const jobByRunner = uniqueRunnerMatches(config, aliases);
  const jobs = { ...workflow.jobs };
  const routed = [];
  const skipped = [];
  const routedAliases = /* @__PURE__ */ new Set();
  delete jobs.freelane;
  for (const [workflowJob, freelaneJob] of Object.entries(options.jobMap ?? {})) {
    if (!config.jobs[freelaneJob]) {
      throw new Error(`--job-map ${workflowJob} references unknown Freelane job: ${freelaneJob}`);
    }
  }
  for (const [workflowJob, job] of Object.entries(jobs)) {
    if (!isRecord2(job)) {
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
    let needs;
    try {
      needs = addNeed(job.needs, "freelane");
    } catch (error) {
      skipped.push({ workflowJob, reason: error instanceof Error ? error.message : String(error) });
      continue;
    }
    jobs[workflowJob] = routedJob(job, needs, workflowRunsOn(config, freelaneJob, alias));
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
    content: (0, import_yaml2.stringify)(workflow, { lineWidth: 0, nullStr: "" }),
    routed,
    skipped,
    workflow: ""
  };
}
function routerJob(aliases, configPath, uses = DEFAULT_ACTION_REF) {
  const outputs = {};
  const steps = [{ uses: "actions/checkout@v7" }];
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
function routedJob(job, needs, runsOn) {
  const next = {};
  if (job.name !== void 0) next.name = job.name;
  next.needs = needs;
  next["runs-on"] = runsOn;
  for (const [key, value] of Object.entries(job)) {
    if (key !== "name" && key !== "needs" && key !== "runs-on") next[key] = value;
  }
  return next;
}
function matchFreelaneJob(config, workflowJob, runner, explicitMap, jobByAlias, jobByRunner) {
  const mapped = explicitMap[workflowJob];
  if (mapped && config.jobs[mapped]) return mapped;
  if (config.jobs[workflowJob]) return workflowJob;
  const aliasMatch = jobByAlias.get(sanitizeOutputName(workflowJob));
  if (aliasMatch) return aliasMatch;
  return jobByRunner.get(runner);
}
function uniqueRunnerMatches(config, aliases) {
  const matches = /* @__PURE__ */ new Map();
  for (const alias of aliases) {
    const decision2 = resolveFreelane(config, alias.job);
    if (!decision2.label) continue;
    const jobs = matches.get(decision2.label) ?? [];
    jobs.push(alias.job);
    matches.set(decision2.label, jobs);
  }
  const unique = /* @__PURE__ */ new Map();
  for (const [runner, jobs] of matches) {
    if (jobs.length === 1) unique.set(runner, jobs[0]);
  }
  return unique;
}
function addNeed(existing, required) {
  if (existing === void 0) return required;
  if (typeof existing === "string") return existing === required ? existing : [required, existing];
  if (Array.isArray(existing) && existing.every((item) => typeof item === "string")) {
    return existing.includes(required) ? existing : [required, ...existing];
  }
  throw new Error("cannot migrate job with non-string needs");
}
function workflowRunsOn(config, job, alias) {
  const jobConfig = config.jobs[job];
  const providerIds = jobConfig.providers ?? Object.keys(config.providers);
  const mayUseRunnerArray = Array.isArray(jobConfig.runner) || providerIds.some((provider) => Array.isArray(config.providers[provider]?.runner));
  if (mayUseRunnerArray) {
    return `\${{ fromJSON(needs.freelane.outputs.${alias}_runs_on) }}`;
  }
  return `\${{ needs.freelane.outputs.${alias} }}`;
}
function sanitizeOutputName(value) {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
  const fallback = sanitized || "job";
  return /^[0-9]/.test(fallback) ? `job_${fallback}` : fallback;
}
function yamlString(value) {
  if (/^[A-Za-z0-9_./@ -]+$/.test(value)) return value;
  return JSON.stringify(value);
}
function shellSafe(value) {
  return value.replace(/["`$\\]/g, "");
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/github-usage.ts
var import_node_fs3 = require("fs");
var import_node_path3 = require("path");
var DEFAULT_DAYS = 30;
var DEFAULT_LIMIT = 50;
async function collectGitHubUsage(options) {
  const repository = normalizeRepo(options.repo);
  const [owner, repo] = repository.split("/");
  const apiUrl = (options.apiUrl ?? "https://api.github.com").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? /* @__PURE__ */ new Date();
  const days = options.days ?? DEFAULT_DAYS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1e3);
  const headers = githubHeaders(options.token);
  const runs = await listRuns({ apiUrl, owner, repo, since, limit, headers, fetchImpl });
  const jobs = [];
  for (const run of runs) {
    const runJobs = await listJobs({ apiUrl, owner, repo, runId: run.id, headers, fetchImpl });
    for (const job of runJobs) {
      const usageJob = usageJobFromWorkflowJob(job);
      if (usageJob) jobs.push(usageJob);
    }
  }
  return {
    source: "github-actions",
    repository,
    generatedAt: now.toISOString(),
    since: since.toISOString(),
    runCount: runs.length,
    jobCount: jobs.length,
    providers: providerTotals(jobs),
    jobs
  };
}
function writeGitHubUsageState(state, output = ".freelane-usage.json") {
  const path = (0, import_node_path3.resolve)(output);
  (0, import_node_fs3.writeFileSync)(path, `${JSON.stringify(state, null, 2)}
`, "utf8");
  return path;
}
function formatGitHubUsageState(state, format) {
  if (format === "json") return `${JSON.stringify(state, null, 2)}
`;
  const rows = Object.entries(state.providers).sort(([left], [right]) => left.localeCompare(right)).map(([provider, total]) => `${provider}	${total.jobs}	${total.minutes}`);
  return [
    `repository	${state.repository}`,
    `since	${state.since}`,
    `runs	${state.runCount}`,
    `jobs	${state.jobCount}`,
    "",
    "provider	jobs	minutes",
    ...rows
  ].join("\n") + "\n";
}
function inferProvider(labels, runnerName = "", runnerGroupName = "") {
  const haystack = [...labels, runnerName, runnerGroupName].join(" ").toLowerCase();
  if (haystack.includes("blacksmith")) return "blacksmith";
  if (haystack.includes("ubicloud")) return "ubicloud";
  if (haystack.includes("warpbuild") || /\bwarp-/.test(haystack)) return "warpbuild";
  if (haystack.includes("namespace") || haystack.includes("nscloud")) return "namespace";
  if (labels.some((label) => isGitHubHostedLabel(label))) return "github";
  return "unknown";
}
function usageJobFromWorkflowJob(job) {
  if (!job.started_at || !job.completed_at) return void 0;
  const started = Date.parse(job.started_at);
  const completed = Date.parse(job.completed_at);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return void 0;
  const labels = job.labels ?? [];
  const durationMinutes = roundQuota((completed - started) / 6e4);
  return {
    runId: job.run_id,
    jobId: job.id,
    name: job.name,
    workflowName: job.workflow_name,
    conclusion: job.conclusion,
    provider: inferProvider(labels, job.runner_name, job.runner_group_name),
    labels,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    durationMinutes
  };
}
function providerTotals(jobs) {
  const totals = {};
  for (const job of jobs) {
    const total = totals[job.provider] ?? { jobs: 0, minutes: 0 };
    total.jobs += 1;
    total.minutes = roundQuota(total.minutes + job.durationMinutes);
    totals[job.provider] = total;
  }
  return totals;
}
async function listRuns(options) {
  const runs = [];
  let page = 1;
  while (runs.length < options.limit) {
    const perPage = Math.min(100, options.limit - runs.length);
    const url = new URL(`${options.apiUrl}/repos/${options.owner}/${options.repo}/actions/runs`);
    url.searchParams.set("status", "completed");
    url.searchParams.set("created", `>=${options.since.toISOString()}`);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    const response = await requestJson(options.fetchImpl, url.toString(), options.headers);
    const pageRuns = response.workflow_runs ?? [];
    runs.push(...pageRuns);
    if (pageRuns.length < perPage) break;
    page += 1;
  }
  return runs;
}
async function listJobs(options) {
  const jobs = [];
  let page = 1;
  while (true) {
    const url = new URL(`${options.apiUrl}/repos/${options.owner}/${options.repo}/actions/runs/${options.runId}/jobs`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await requestJson(options.fetchImpl, url.toString(), options.headers);
    const pageJobs = response.jobs ?? [];
    jobs.push(...pageJobs);
    if (pageJobs.length < 100) break;
    page += 1;
  }
  return jobs;
}
async function requestJson(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "freelane-ci"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
function normalizeRepo(repo) {
  if (!/^[^/]+\/[^/]+$/.test(repo)) {
    throw new Error("--repo must use owner/repo");
  }
  return repo;
}
function isGitHubHostedLabel(label) {
  return /^(ubuntu|windows|macos)-/.test(label.toLowerCase());
}

// src/init.ts
var import_node_fs4 = require("fs");
var import_node_path4 = require("path");

// src/constants.ts
var CONFIG_SCHEMA_URL = "https://raw.githubusercontent.com/thoughts-on-things/freelane-ci/main/schemas/freelane.schema.json";

// src/init.ts
function starterConfig() {
  return [
    `$schema: ${CONFIG_SCHEMA_URL}`,
    "version: 1",
    "",
    "defaults:",
    "  paid: avoid",
    "  fallback:",
    "    mode: pre_schedule",
    "    providers: [github]",
    "",
    "providers:",
    "  github:",
    "    enabled: true",
    "  blacksmith:",
    "    enabled: false",
    "    free_minutes_per_month: 3000",
    "  ubicloud:",
    "    enabled: false",
    "    free_credit_usd_per_month: 2",
    "  warpbuild:",
    "    enabled: false",
    "    free_credit_usd_per_month: 10",
    "  namespace:",
    "    enabled: false",
    "    unit_minutes_per_month: 100000",
    "",
    "jobs:",
    "  test-linux:",
    "    os: linux",
    "    arch: x64",
    "    min_vcpu: 2",
    "    estimate_minutes: 8",
    "    providers: [blacksmith, ubicloud, warpbuild, github]",
    ""
  ].join("\n");
}
function writeStarterConfig(options = {}) {
  const output = (0, import_node_path4.resolve)(options.cwd ?? process.cwd(), options.output ?? ".freelane.yml");
  if ((0, import_node_fs4.existsSync)(output) && !options.force) {
    throw new Error(`${output} already exists; pass --force to overwrite`);
  }
  (0, import_node_fs4.writeFileSync)(output, starterConfig(), "utf8");
  return output;
}

// src/plan.ts
function planFreelane(config, jobIds = Object.keys(config.jobs)) {
  const working = copyConfig(config);
  const decisions = jobIds.map((jobId) => {
    const decision2 = resolveFreelane(working, jobId);
    const planned = {
      ...decision2,
      remaining: remainingAfter(decision2.available, decision2.quotaBurn)
    };
    consumeQuota(working.providers[decision2.provider], decision2.quotaUnit, decision2.quotaBurn);
    return planned;
  });
  return { decisions };
}
function formatPlan(plan, format) {
  if (format === "json") return `${JSON.stringify(plan, null, 2)}
`;
  return [
    "job	provider	runner	burn	remaining	reason",
    ...plan.decisions.map((decision2) => [
      decision2.job,
      decision2.provider,
      decision2.runsOnJson,
      formatAmount(decision2.quotaBurn, decision2.quotaUnit),
      formatAmount(decision2.remaining, decision2.quotaUnit),
      decision2.reason
    ].join("	"))
  ].join("\n") + "\n";
}
function copyConfig(config) {
  return {
    ...config,
    defaults: config.defaults ? { ...config.defaults } : void 0,
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([id, provider]) => [id, { ...provider }])
    ),
    jobs: Object.fromEntries(
      Object.entries(config.jobs).map(([id, job]) => [id, { ...job }])
    )
  };
}
function consumeQuota(provider, unit, burn) {
  if (!provider || unit === "unlimited" || burn <= 0 || !Number.isFinite(burn)) return;
  if (unit === "usd") {
    provider.used_credit_usd = roundQuota((provider.used_credit_usd ?? 0) + burn);
  } else if (unit === "unit_minutes") {
    provider.used_unit_minutes = roundQuota((provider.used_unit_minutes ?? 0) + burn);
  } else {
    provider.used_minutes = roundQuota((provider.used_minutes ?? 0) + burn);
  }
}
function remainingAfter(available, burn) {
  if (!Number.isFinite(available)) return available;
  return roundQuota(available - burn);
}
function formatAmount(value, unit) {
  if (!Number.isFinite(value)) return "unlimited";
  if (unit === "unlimited") return String(value);
  return `${value} ${displayUnit(unit)}`;
}

// src/provider-list.ts
var providers = [
  {
    id: "github",
    name: "GitHub",
    adapter: "hosted runner labels",
    quota: "minutes or unlimited",
    notes: "default fallback"
  },
  {
    id: "blacksmith",
    name: "Blacksmith",
    adapter: "GitHub-compatible runner labels",
    quota: "minutes or usd",
    notes: "linux, windows, macos"
  },
  {
    id: "ubicloud",
    name: "Ubicloud",
    adapter: "GitHub-compatible runner labels",
    quota: "usd",
    notes: "linux"
  },
  {
    id: "warpbuild",
    name: "WarpBuild",
    adapter: "GitHub-compatible runner labels",
    quota: "usd",
    notes: "linux, windows, macos"
  },
  {
    id: "namespace",
    name: "Namespace",
    adapter: "GitHub-compatible runner labels",
    quota: "unit minutes",
    notes: "supports profiles"
  }
];
function listProviders() {
  return providers.map((provider) => ({ ...provider }));
}
function formatProviderList(items, format) {
  if (format === "json") return `${JSON.stringify({ providers: items }, null, 2)}
`;
  return [
    "id	name	quota	notes",
    ...items.map((provider) => `${provider.id}	${provider.name}	${provider.quota}	${provider.notes}`)
  ].join("\n") + "\n";
}

// src/schema.ts
var import__ = __toESM(require("ajv/dist/2020"));
var import_node_fs5 = require("fs");
var import_yaml3 = require("yaml");

// schemas/freelane.schema.json
var freelane_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://freelane-ci.dev/schemas/freelane.schema.json",
  title: "Freelane CI config",
  type: "object",
  required: ["version", "providers", "jobs"],
  additionalProperties: false,
  properties: {
    $schema: {
      type: "string"
    },
    version: {
      const: 1
    },
    defaults: {
      type: "object",
      additionalProperties: false,
      properties: {
        paid: {
          enum: ["avoid", "allow", "forbid"]
        },
        reserve: {
          type: "object",
          additionalProperties: {
            type: "number",
            minimum: 0
          }
        },
        fallback: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: {
              const: "pre_schedule"
            },
            providers: {
              type: "array",
              items: {
                type: "string",
                minLength: 1
              }
            }
          }
        },
        alerts: {
          type: "object",
          additionalProperties: false,
          properties: {
            github_summary: {
              type: "boolean"
            },
            github_warning: {
              type: "boolean"
            },
            webhook_url: {
              type: "string"
            }
          }
        }
      }
    },
    providers: {
      type: "object",
      minProperties: 1,
      additionalProperties: {
        $ref: "#/$defs/provider"
      }
    },
    jobs: {
      type: "object",
      minProperties: 1,
      additionalProperties: {
        $ref: "#/$defs/job"
      }
    }
  },
  $defs: {
    runner: {
      oneOf: [
        {
          type: "string",
          minLength: 1
        },
        {
          type: "array",
          items: {
            type: "string",
            minLength: 1
          },
          minItems: 1
        }
      ]
    },
    provider: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: {
          type: "boolean"
        },
        free_minutes_per_month: {
          type: "number",
          minimum: 0
        },
        free_credit_usd_per_month: {
          type: "number",
          minimum: 0
        },
        unit_minutes_per_month: {
          type: "number",
          minimum: 0
        },
        used_minutes: {
          type: "number",
          minimum: 0
        },
        used_credit_usd: {
          type: "number",
          minimum: 0
        },
        used_unit_minutes: {
          type: "number",
          minimum: 0
        },
        runner: {
          $ref: "#/$defs/runner"
        },
        profile: {
          type: "string",
          minLength: 1
        },
        owner: {
          type: "string",
          minLength: 1
        },
        scope: {
          enum: ["user", "org", "enterprise"]
        }
      }
    },
    job: {
      type: "object",
      required: ["os"],
      additionalProperties: false,
      properties: {
        os: {
          enum: ["linux", "windows", "macos"]
        },
        arch: {
          enum: ["x64", "arm64"]
        },
        min_vcpu: {
          type: "number",
          minimum: 1
        },
        estimate_minutes: {
          type: "number",
          minimum: 0
        },
        providers: {
          type: "array",
          items: {
            type: "string",
            minLength: 1
          },
          minItems: 1
        },
        runner: {
          $ref: "#/$defs/runner"
        }
      }
    }
  }
};

// src/schema.ts
function validateConfigFile(path = findConfigPath()) {
  const config = (0, import_yaml3.parse)((0, import_node_fs5.readFileSync)(path, "utf8"));
  const ajv = new import__.default({ allErrors: true });
  const validate = ajv.compile(freelane_schema_default);
  const schemaValid = validate(config);
  const issues = [
    ...(validate.errors ?? []).map((error) => ({
      path: error.instancePath || "/",
      message: error.message ?? "invalid value"
    })),
    ...semanticIssues(config)
  ];
  return {
    valid: schemaValid && issues.length === 0,
    path,
    issues
  };
}
function formatValidation(result, format) {
  if (format === "json") return `${JSON.stringify(result, null, 2)}
`;
  if (result.valid) return `valid ${result.path}
`;
  return [
    `invalid ${result.path}`,
    ...result.issues.map((issue) => `- ${issue.path} ${issue.message}`)
  ].join("\n") + "\n";
}
function semanticIssues(config) {
  if (!isRecord3(config) || !isRecord3(config.providers) || !isRecord3(config.jobs)) return [];
  const issues = [];
  const providerIds = new Set(Object.keys(config.providers));
  if (isRecord3(config.defaults)) {
    if (isRecord3(config.defaults.reserve)) {
      for (const providerId of Object.keys(config.defaults.reserve)) {
        if (!providerIds.has(providerId)) {
          issues.push({
            path: pointer("defaults", "reserve", providerId),
            message: `references unknown provider "${providerId}"`
          });
        }
      }
    }
    if (isRecord3(config.defaults.fallback)) {
      issues.push(...providerReferenceIssues(config.defaults.fallback.providers, pointer("defaults", "fallback", "providers"), providerIds));
    }
  }
  for (const [jobId, job] of Object.entries(config.jobs)) {
    if (isRecord3(job)) {
      issues.push(...providerReferenceIssues(job.providers, pointer("jobs", jobId, "providers"), providerIds));
    }
  }
  return issues;
}
function providerReferenceIssues(value, path, providerIds) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((providerId, index) => {
    if (typeof providerId !== "string" || providerIds.has(providerId)) return [];
    return [{
      path: `${path}/${index}`,
      message: `references unknown provider "${providerId}"`
    }];
  });
}
function pointer(...segments) {
  return `/${segments.map((segment) => segment.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// src/usage.ts
function usageReport(config) {
  const entries = Object.entries(config.providers).map(([providerId, provider]) => {
    const quotaUnit = quotaUnitForProvider(provider);
    const reserve = config.defaults?.reserve?.[providerId] ?? 0;
    const quota = quotaFor(provider, quotaUnit, reserve);
    return {
      provider: providerId,
      enabled: provider.enabled !== false,
      quotaUnit,
      total: usageAmount(quota.total),
      used: roundQuota(quota.used),
      reserve: roundQuota(reserve),
      available: usageAmount(quota.available)
    };
  });
  return { entries };
}
function formatUsageReport(report, format) {
  if (format === "json") return `${JSON.stringify(report, null, 2)}
`;
  return [
    "provider	enabled	total	used	reserve	available",
    ...report.entries.map((entry) => [
      entry.provider,
      String(entry.enabled),
      formatAmount2(entry.total, entry.quotaUnit),
      formatAmount2(entry.used, entry.quotaUnit),
      formatAmount2(entry.reserve, entry.quotaUnit),
      formatAmount2(entry.available, entry.quotaUnit)
    ].join("	"))
  ].join("\n") + "\n";
}
function usageAmount(value) {
  if (!Number.isFinite(value)) return "unlimited";
  return roundQuota(value);
}
function formatAmount2(value, unit) {
  if (value === "unlimited") return value;
  if (unit === "unlimited") return String(value);
  return `${value} ${displayUnit(unit)}`;
}

// src/usage-state.ts
var import_node_fs6 = require("fs");
var import_node_path5 = require("path");
var DEFAULT_USAGE_STATE = ".freelane-usage.json";
function loadUsageState(path = DEFAULT_USAGE_STATE) {
  const parsed = JSON.parse((0, import_node_fs6.readFileSync)(path, "utf8"));
  if (parsed.source !== "github-actions" || !parsed.providers) {
    throw new Error(`${path}: unsupported usage state`);
  }
  return parsed;
}
function applyUsageState(config, state) {
  const next = copyConfig2(config);
  for (const [providerId, total] of Object.entries(state.providers)) {
    const provider = next.providers[providerId];
    if (!provider || quotaUnitForProvider(provider) !== "minutes") continue;
    provider.used_minutes = roundQuota((provider.used_minutes ?? 0) + total.minutes);
  }
  return next;
}
function applyUsageStateIfPresent(config, options = {}) {
  if (options.disabled) return config;
  const path = (0, import_node_path5.resolve)(options.path ?? DEFAULT_USAGE_STATE);
  if (!options.path && !(0, import_node_fs6.existsSync)(path)) return config;
  return applyUsageState(config, loadUsageState(path));
}
function copyConfig2(config) {
  return {
    ...config,
    defaults: config.defaults ? { ...config.defaults } : void 0,
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([id, provider]) => [id, { ...provider }])
    ),
    jobs: Object.fromEntries(
      Object.entries(config.jobs).map(([id, job]) => [id, { ...job }])
    )
  };
}

// src/cli.ts
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "resolve") {
    if (!args.job) throw new Error("missing required --job");
    const config = loadConfigForRouting(args);
    const decision2 = resolveFreelane(config, args.job);
    process.stdout.write(formatDecision(decision2, args.format));
    return;
  }
  if (args.command === "plan") {
    const config = loadConfigForRouting(args);
    process.stdout.write(formatPlan(planFreelane(config), args.format));
    return;
  }
  if (args.command === "providers" && args.subcommand === "doctor") {
    const config = loadConfigForRouting(args);
    process.stdout.write(formatDoctor(doctorConfig(config), args.format));
    return;
  }
  if (args.command === "providers" && args.subcommand === "list") {
    process.stdout.write(formatProviderList(listProviders(), args.format));
    return;
  }
  if (args.command === "usage" && args.subcommand === "report") {
    const config = loadConfigForRouting(args);
    process.stdout.write(formatUsageReport(usageReport(config), args.format));
    return;
  }
  if (args.command === "usage" && args.subcommand === "sync-github") {
    const repo = args.repo ?? process.env.GITHUB_REPOSITORY;
    if (!repo) throw new Error("missing required --repo owner/repo");
    const state = await collectGitHubUsage({
      repo,
      token: args.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN,
      days: args.days,
      limit: args.limit
    });
    writeGitHubUsageState(state, args.output);
    process.stdout.write(formatGitHubUsageState(state, args.format));
    return;
  }
  if (args.command === "config" && args.subcommand === "validate") {
    const result = validateConfigFile(args.config);
    process.stdout.write(formatValidation(result, args.format));
    if (!result.valid) process.exit(1);
    return;
  }
  if (args.command === "migrate" && args.subcommand === "github-actions") {
    if (!args.workflow) throw new Error("missing required --workflow");
    const config = loadConfig(args.config);
    const migration = migrateGitHubActionsWorkflow(config, {
      configPath: args.config ?? ".freelane.yml",
      dryRun: args.dryRun,
      force: args.force,
      jobMap: args.jobMap,
      uses: args.uses,
      workflow: args.workflow
    });
    if (args.dryRun) {
      process.stdout.write(migration.content);
      return;
    }
    process.stdout.write(formatMigrationSummary(migration.changed, migration.routed.length, migration.skipped.length, migration.workflow));
    return;
  }
  if (args.command === "init" && args.subcommand === "github-actions") {
    const config = loadConfig(args.config);
    const output = writeGitHubActionsWorkflow(config, {
      configPath: args.config ?? ".freelane.yml",
      force: args.force,
      output: args.output,
      uses: args.uses
    });
    process.stdout.write(`created ${output}
`);
    return;
  }
  if (args.command === "init") {
    const output = writeStarterConfig({ output: args.output, force: args.force });
    process.stdout.write(`created ${output}
`);
    return;
  }
  usage(0);
}
function parseArgs(argv) {
  const args = { command: argv[0], format: "text", jobMap: {} };
  let start = 1;
  if (args.command === "providers" || args.command === "config" || args.command === "usage") {
    args.subcommand = argv[1];
    start = 2;
  } else if (args.command === "init" && argv[1] === "github-actions") {
    args.subcommand = argv[1];
    start = 2;
  } else if (args.command === "migrate" && argv[1] === "github-actions") {
    args.subcommand = argv[1];
    start = 2;
  }
  for (let i = start; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") usage(0);
    if (value === "--config") args.config = argv[++i];
    else if (value === "--days") args.days = parsePositiveInt(argv[++i], "--days");
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--force") args.force = true;
    else if (value === "--job") args.job = argv[++i];
    else if (value === "--job-map") addJobMap(args.jobMap, argv[++i]);
    else if (value === "--limit") args.limit = parsePositiveInt(argv[++i], "--limit");
    else if (value === "--output") args.output = argv[++i];
    else if (value === "--repo") args.repo = argv[++i];
    else if (value === "--token") args.token = argv[++i];
    else if (value === "--usage-state") args.usageState = argv[++i];
    else if (value === "--no-usage-state") args.noUsageState = true;
    else if (value === "--uses") args.uses = argv[++i];
    else if (value === "--workflow") args.workflow = argv[++i];
    else if (value === "--format") args.format = parseFormat(argv[++i]);
    else throw new Error(`unknown argument: ${value}`);
  }
  return args;
}
function parseFormat(value) {
  if (value === "text" || value === "json" || value === "github-output") return value;
  throw new Error(`unsupported format: ${value}`);
}
function parsePositiveInt(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}
function addJobMap(map, value) {
  const [workflowJob, freelaneJob, ...extra] = value.split("=");
  if (!workflowJob || !freelaneJob || extra.length > 0) {
    throw new Error("--job-map must be workflow-job=freelane-job");
  }
  map[workflowJob] = freelaneJob;
}
function formatMigrationSummary(changed, routed, skipped, workflow) {
  if (!changed) return `no changes ${workflow}; routed 0 jobs, skipped ${skipped}
`;
  return `updated ${workflow}; routed ${routed} jobs, skipped ${skipped}
`;
}
function loadConfigForRouting(args) {
  const config = loadConfig(args.config);
  return applyUsageStateIfPresent(config, {
    path: args.usageState,
    disabled: args.noUsageState
  });
}
function usage(code) {
  process.stdout.write([
    "Usage:",
    "  freelane init [--output .freelane.yml] [--force]",
    "  freelane init github-actions [--config .freelane.yml] [--output .github/workflows/freelane-ci.yml] [--uses thoughts-on-things/freelane-ci@v0] [--force]",
    "  freelane migrate github-actions --workflow .github/workflows/ci.yml [--config .freelane.yml] [--job-map workflow-job=freelane-job] [--dry-run] [--force]",
    "  freelane config validate [--config .freelane.yml] [--format text|json]",
    "  freelane plan [--config .freelane.yml] [--usage-state .freelane-usage.json] [--format text|json]",
    "  freelane resolve --job <job> [--config .freelane.yml] [--usage-state .freelane-usage.json] [--format text|json|github-output]",
    "  freelane providers doctor [--config .freelane.yml] [--usage-state .freelane-usage.json] [--format text|json]",
    "  freelane providers list [--format text|json]",
    "  freelane usage report [--config .freelane.yml] [--usage-state .freelane-usage.json] [--format text|json]",
    "  freelane usage sync-github [--repo owner/repo] [--days 30] [--limit 50] [--output .freelane-usage.json] [--format text|json]"
  ].join("\n") + "\n");
  process.exit(code);
}
void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`freelane: ${message}
`);
  process.exit(1);
});

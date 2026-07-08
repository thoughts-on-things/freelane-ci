#!/usr/bin/env node
"use strict";

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

// src/format.ts
function formatDecision(decision2, format) {
  if (format === "json") return `${JSON.stringify(decision2, null, 2)}
`;
  if (format === "github-output") {
    return [
      `runs_on=${decision2.runsOnJson}`,
      `provider=${decision2.provider}`,
      `runner=${JSON.stringify(decision2.runner)}`,
      `reason=${decision2.reason}`
    ].join("\n") + "\n";
  }
  return `${decision2.provider} ${decision2.runsOnJson} - ${decision2.reason}
`;
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
    return option(providerId, provider.runner, job.min_vcpu ?? 2, priceFor(providerId, job), job, quotaUnitFor(provider));
  }
  const factory = providerFactories[providerId];
  return factory?.(provider, job);
}
function githubRunner(_provider, job) {
  const arch = job.arch ?? "x64";
  const label = githubLabel(job.os, arch);
  if (!label) return void 0;
  return option("github", label, job.min_vcpu ?? 2, void 0, job, quotaUnitFor(_provider));
}
function blacksmithRunner(provider, job) {
  const arch = job.arch ?? "x64";
  const vcpu = nearestVcpu(job.min_vcpu);
  const quotaUnit = quotaUnitFor(provider);
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
  const quotaUnit = quotaUnitFor(provider);
  if (job.os !== "linux") return void 0;
  if (arch === "x64") {
    return option("ubicloud", `ubicloud-standard-${vcpu}`, vcpu, priceFor("ubicloud", job), job, quotaUnit);
  }
  return option("ubicloud", `ubicloud-standard-${vcpu}-arm`, vcpu, priceFor("ubicloud", job), job, quotaUnit);
}
function warpbuildRunner(provider, job) {
  const arch = job.arch ?? "x64";
  const vcpu = nearestVcpu(job.min_vcpu);
  const quotaUnit = quotaUnitFor(provider);
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
    return option("namespace", `namespace-profile-${provider.profile}`, job.min_vcpu ?? 4, void 0, job, quotaUnitFor(provider));
  }
  const arch = job.arch === "arm64" ? "arm64" : "amd64";
  const vcpu = nearestVcpu(job.min_vcpu, [2, 4, 8, 16, 32]);
  const memory = vcpu * 2;
  const os = namespaceOs(job.os);
  if (!os) return void 0;
  return option("namespace", `nscloud-${os}-${arch}-${vcpu}x${memory}`, vcpu, void 0, job, quotaUnitFor(provider, "unit_minutes"));
}
function option(provider, runner, vcpu, unitPriceUsd, job, quotaUnit) {
  const minutes = job.estimate_minutes ?? 10;
  const quotaBurn = quotaUnit === "unlimited" ? 0 : quotaUnit === "usd" ? minutes * (unitPriceUsd ?? 0) : unitBurn(provider, job.os, vcpu, minutes);
  return { provider, runner, vcpu, unitPriceUsd, quotaBurn, quotaUnit };
}
function quotaUnitFor(provider, fallback = "unlimited") {
  if (provider.free_credit_usd_per_month !== void 0) return "usd";
  if (provider.free_minutes_per_month !== void 0) return "minutes";
  if (provider.unit_minutes_per_month !== void 0) return "unit_minutes";
  return fallback;
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
  const quota = quotaFor(provider, option2.quotaUnit);
  const reserve = config.defaults?.reserve?.[providerId] ?? 0;
  const available = quota.total - quota.used - reserve;
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
function quotaFor(provider, unit) {
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
function decision(jobId, candidate, reason) {
  const runner = candidate.option.runner;
  return {
    job: jobId,
    provider: candidate.option.provider,
    runner,
    runsOnJson: JSON.stringify(runner),
    reason,
    paidRequired: candidate.paidRequired,
    quotaUnit: candidate.option.quotaUnit,
    quotaBurn: round(candidate.option.quotaBurn),
    available: round(candidate.available)
  };
}
function directDecision(jobId, job) {
  const runner = job.runner ?? "ubuntu-latest";
  return {
    job: jobId,
    provider: "manual",
    runner,
    runsOnJson: JSON.stringify(runner),
    reason: "selected job-specific runner",
    paidRequired: false,
    quotaUnit: "unlimited",
    quotaBurn: 0,
    available: Number.POSITIVE_INFINITY
  };
}
function round(value) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e4) / 1e4;
}

// src/cli.ts
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== "resolve") {
    usage(0);
  }
  if (!args.job) {
    throw new Error("missing required --job");
  }
  const config = loadConfig(args.config);
  const decision2 = resolveFreelane(config, args.job);
  process.stdout.write(formatDecision(decision2, args.format));
}
function parseArgs(argv) {
  const args = { command: argv[0], format: "text" };
  for (let i = 1; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") usage(0);
    if (value === "--config") args.config = argv[++i];
    else if (value === "--job") args.job = argv[++i];
    else if (value === "--format") args.format = parseFormat(argv[++i]);
    else throw new Error(`unknown argument: ${value}`);
  }
  return args;
}
function parseFormat(value) {
  if (value === "text" || value === "json" || value === "github-output") return value;
  throw new Error(`unsupported format: ${value}`);
}
function usage(code) {
  process.stdout.write("Usage: freelane resolve --job <job> [--config .freelane.yml] [--format text|json|github-output]\n");
  process.exit(code);
}
try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`freelane: ${message}
`);
  process.exit(1);
}

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  displayUnit: () => displayUnit,
  doctorConfig: () => doctorConfig,
  findConfigPath: () => findConfigPath,
  formatDecision: () => formatDecision,
  formatDoctor: () => formatDoctor,
  formatProviderList: () => formatProviderList,
  formatValidation: () => formatValidation,
  getRunnerOption: () => getRunnerOption,
  listProviders: () => listProviders,
  loadConfig: () => loadConfig,
  providerFactories: () => providerFactories,
  quotaFor: () => quotaFor,
  resolveFreelane: () => resolveFreelane,
  roundQuota: () => roundQuota,
  starterConfig: () => starterConfig,
  validateConfigFile: () => validateConfigFile,
  writeStarterConfig: () => writeStarterConfig
});
module.exports = __toCommonJS(index_exports);

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

// src/init.ts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
function starterConfig() {
  return [
    "$schema: ./schemas/freelane.schema.json",
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
  const output = (0, import_node_path2.resolve)(options.cwd ?? process.cwd(), options.output ?? ".freelane.yml");
  if ((0, import_node_fs2.existsSync)(output) && !options.force) {
    throw new Error(`${output} already exists; pass --force to overwrite`);
  }
  (0, import_node_fs2.writeFileSync)(output, starterConfig(), "utf8");
  return output;
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
    runsOnJson: JSON.stringify(runner),
    reason: "selected job-specific runner",
    paidRequired: false,
    quotaUnit: "unlimited",
    quotaBurn: 0,
    available: Number.POSITIVE_INFINITY
  };
}

// src/schema.ts
var import__ = __toESM(require("ajv/dist/2020"));
var import_node_fs3 = require("fs");
var import_yaml2 = require("yaml");

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
  const config = (0, import_yaml2.parse)((0, import_node_fs3.readFileSync)(path, "utf8"));
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
  if (!isRecord2(config) || !isRecord2(config.providers) || !isRecord2(config.jobs)) return [];
  const issues = [];
  const providerIds = new Set(Object.keys(config.providers));
  if (isRecord2(config.defaults)) {
    if (isRecord2(config.defaults.reserve)) {
      for (const providerId of Object.keys(config.defaults.reserve)) {
        if (!providerIds.has(providerId)) {
          issues.push({
            path: pointer("defaults", "reserve", providerId),
            message: `references unknown provider "${providerId}"`
          });
        }
      }
    }
    if (isRecord2(config.defaults.fallback)) {
      issues.push(...providerReferenceIssues(config.defaults.fallback.providers, pointer("defaults", "fallback", "providers"), providerIds));
    }
  }
  for (const [jobId, job] of Object.entries(config.jobs)) {
    if (isRecord2(job)) {
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
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  displayUnit,
  doctorConfig,
  findConfigPath,
  formatDecision,
  formatDoctor,
  formatProviderList,
  formatValidation,
  getRunnerOption,
  listProviders,
  loadConfig,
  providerFactories,
  quotaFor,
  resolveFreelane,
  roundQuota,
  starterConfig,
  validateConfigFile,
  writeStarterConfig
});

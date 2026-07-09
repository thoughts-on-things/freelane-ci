#!/usr/bin/env node
import { loadConfig } from "./config";
import { doctorConfig, formatDoctor } from "./doctor";
import { formatDecision } from "./format";
import { writeGitHubActionsWorkflow } from "./github-actions";
import { collectGitHubUsage, formatGitHubUsageState, writeGitHubUsageState } from "./github-usage";
import { writeStarterConfig } from "./init";
import { formatPlan, planFreelane } from "./plan";
import { formatProviderList, listProviders } from "./provider-list";
import { resolveFreelane } from "./resolve";
import { formatValidation, validateConfigFile } from "./schema";
import { formatUsageReport, usageReport } from "./usage";
import { applyUsageStateIfPresent } from "./usage-state";

interface Args {
  command?: string;
  subcommand?: string;
  config?: string;
  days?: number;
  force?: boolean;
  job?: string;
  limit?: number;
  output?: string;
  repo?: string;
  token?: string;
  usageState?: string;
  noUsageState?: boolean;
  uses?: string;
  format: "text" | "json" | "github-output";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "resolve") {
    if (!args.job) throw new Error("missing required --job");
    const config = loadConfigForRouting(args);
    const decision = resolveFreelane(config, args.job);
    process.stdout.write(formatDecision(decision, args.format));
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

  if (args.command === "init" && args.subcommand === "github-actions") {
    const config = loadConfig(args.config);
    const output = writeGitHubActionsWorkflow(config, {
      configPath: args.config ?? ".freelane.yml",
      force: args.force,
      output: args.output,
      uses: args.uses
    });
    process.stdout.write(`created ${output}\n`);
    return;
  }

  if (args.command === "init") {
    const output = writeStarterConfig({ output: args.output, force: args.force });
    process.stdout.write(`created ${output}\n`);
    return;
  }

  usage(0);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0], format: "text" };
  let start = 1;
  if (args.command === "providers" || args.command === "config" || args.command === "usage") {
    args.subcommand = argv[1];
    start = 2;
  } else if (args.command === "init" && argv[1] === "github-actions") {
    args.subcommand = argv[1];
    start = 2;
  }

  for (let i = start; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") usage(0);
    if (value === "--config") args.config = argv[++i];
    else if (value === "--days") args.days = parsePositiveInt(argv[++i], "--days");
    else if (value === "--force") args.force = true;
    else if (value === "--job") args.job = argv[++i];
    else if (value === "--limit") args.limit = parsePositiveInt(argv[++i], "--limit");
    else if (value === "--output") args.output = argv[++i];
    else if (value === "--repo") args.repo = argv[++i];
    else if (value === "--token") args.token = argv[++i];
    else if (value === "--usage-state") args.usageState = argv[++i];
    else if (value === "--no-usage-state") args.noUsageState = true;
    else if (value === "--uses") args.uses = argv[++i];
    else if (value === "--format") args.format = parseFormat(argv[++i]);
    else throw new Error(`unknown argument: ${value}`);
  }
  return args;
}

function parseFormat(value: string): Args["format"] {
  if (value === "text" || value === "json" || value === "github-output") return value;
  throw new Error(`unsupported format: ${value}`);
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function loadConfigForRouting(args: Args) {
  const config = loadConfig(args.config);
  return applyUsageStateIfPresent(config, {
    path: args.usageState,
    disabled: args.noUsageState
  });
}

function usage(code: number): never {
  process.stdout.write([
    "Usage:",
    "  freelane init [--output .freelane.yml] [--force]",
    "  freelane init github-actions [--config .freelane.yml] [--output .github/workflows/freelane-ci.yml] [--uses thoughts-on-things/freelane-ci@v0] [--force]",
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
  process.stderr.write(`freelane: ${message}\n`);
  process.exit(1);
});

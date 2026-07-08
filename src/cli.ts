#!/usr/bin/env node
import { loadConfig } from "./config";
import { doctorConfig, formatDoctor } from "./doctor";
import { formatDecision } from "./format";
import { resolveFreelane } from "./resolve";

interface Args {
  command?: string;
  subcommand?: string;
  config?: string;
  job?: string;
  format: "text" | "json" | "github-output";
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "resolve") {
    if (!args.job) throw new Error("missing required --job");
    const config = loadConfig(args.config);
    const decision = resolveFreelane(config, args.job);
    process.stdout.write(formatDecision(decision, args.format));
    return;
  }

  if (args.command === "providers" && args.subcommand === "doctor") {
    const config = loadConfig(args.config);
    process.stdout.write(formatDoctor(doctorConfig(config), args.format));
    return;
  }

  usage(0);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0], format: "text" };
  let start = 1;
  if (args.command === "providers") {
    args.subcommand = argv[1];
    start = 2;
  }

  for (let i = start; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") usage(0);
    if (value === "--config") args.config = argv[++i];
    else if (value === "--job") args.job = argv[++i];
    else if (value === "--format") args.format = parseFormat(argv[++i]);
    else throw new Error(`unknown argument: ${value}`);
  }
  return args;
}

function parseFormat(value: string): Args["format"] {
  if (value === "text" || value === "json" || value === "github-output") return value;
  throw new Error(`unsupported format: ${value}`);
}

function usage(code: number): never {
  process.stdout.write([
    "Usage:",
    "  freelane resolve --job <job> [--config .freelane.yml] [--format text|json|github-output]",
    "  freelane providers doctor [--config .freelane.yml] [--format text|json]"
  ].join("\n") + "\n");
  process.exit(code);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`freelane: ${message}\n`);
  process.exit(1);
}

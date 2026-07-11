import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONFIG_SCHEMA_URL } from "./constants";

export interface InitOptions {
  output?: string;
  force?: boolean;
  cwd?: string;
}

export function starterConfig(): string {
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
    "    providers: [github, blacksmith, ubicloud, warpbuild]",
    ""
  ].join("\n");
}

export function writeStarterConfig(options: InitOptions = {}): string {
  const output = resolve(options.cwd ?? process.cwd(), options.output ?? ".freelane.yml");
  if (existsSync(output) && !options.force) {
    throw new Error(`${output} already exists; pass --force to overwrite`);
  }
  writeFileSync(output, starterConfig(), "utf8");
  return output;
}

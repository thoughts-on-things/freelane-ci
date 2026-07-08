import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { FreelaneConfig, JobConfig, ProviderConfig } from "./types";

const DEFAULT_CONFIGS = [".freelane.yml", ".freelane.yaml", "freelane.yml", "freelane.yaml"];

export function findConfigPath(cwd = process.cwd()): string {
  for (const name of DEFAULT_CONFIGS) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  return resolve(cwd, ".freelane.yml");
}

export function loadConfig(path = findConfigPath()): FreelaneConfig {
  const raw = readFileSync(path, "utf8");
  const config = parse(raw) as FreelaneConfig;
  validateConfig(config, path);
  return config;
}

function validateConfig(config: FreelaneConfig, path: string): void {
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

function validateProvider(path: string, id: string, provider: ProviderConfig): void {
  if (!isRecord(provider)) {
    throw new Error(`${path}: providers.${id} must be an object`);
  }
}

function validateJob(path: string, id: string, job: JobConfig): void {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GitHubUsageState } from "./github-usage";
import { quotaUnitForProvider, roundQuota } from "./quota";
import type { FreelaneConfig } from "./types";

export const DEFAULT_USAGE_STATE = ".freelane-usage.json";

export interface UsageStateOptions {
  path?: string;
  disabled?: boolean;
}

export function loadUsageState(path = DEFAULT_USAGE_STATE): GitHubUsageState {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as GitHubUsageState;
  if (parsed.source !== "github-actions" || !parsed.providers) {
    throw new Error(`${path}: unsupported usage state`);
  }
  return parsed;
}

export function applyUsageState(config: FreelaneConfig, state: GitHubUsageState): FreelaneConfig {
  const next = copyConfig(config);

  for (const [providerId, total] of Object.entries(state.providers)) {
    const provider = next.providers[providerId];
    if (!provider || quotaUnitForProvider(provider) !== "minutes") continue;
    provider.used_minutes = roundQuota((provider.used_minutes ?? 0) + total.minutes);
  }

  return next;
}

export function applyUsageStateIfPresent(config: FreelaneConfig, options: UsageStateOptions = {}): FreelaneConfig {
  if (options.disabled) return config;

  const path = resolve(options.path ?? DEFAULT_USAGE_STATE);
  if (!options.path && !existsSync(path)) return config;
  return applyUsageState(config, loadUsageState(path));
}

function copyConfig(config: FreelaneConfig): FreelaneConfig {
  return {
    ...config,
    defaults: config.defaults ? { ...config.defaults } : undefined,
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([id, provider]) => [id, { ...provider }])
    ),
    jobs: Object.fromEntries(
      Object.entries(config.jobs).map(([id, job]) => [id, { ...job }])
    )
  };
}

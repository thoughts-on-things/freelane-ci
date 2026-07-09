export type RunnerOs = "linux" | "windows" | "macos";
export type RunnerArch = "x64" | "arm64";
export type PaidPolicy = "avoid" | "allow" | "forbid";
export type QuotaUnit = "minutes" | "usd" | "unit_minutes" | "unlimited";

export interface FreelaneConfig {
  version: 1;
  defaults?: DefaultsConfig;
  providers: Record<string, ProviderConfig>;
  jobs: Record<string, JobConfig>;
}

export interface DefaultsConfig {
  paid?: PaidPolicy;
  reserve?: Record<string, number>;
  fallback?: {
    mode?: "pre_schedule";
    providers?: string[];
  };
  alerts?: {
    github_summary?: boolean;
    github_warning?: boolean;
    webhook_url?: string;
  };
}

export interface ProviderConfig {
  enabled?: boolean;
  free_minutes_per_month?: number;
  free_credit_usd_per_month?: number;
  unit_minutes_per_month?: number;
  used_minutes?: number;
  used_credit_usd?: number;
  used_unit_minutes?: number;
  runner?: string | string[];
  profile?: string;
  owner?: string;
  scope?: "user" | "org" | "enterprise";
}

export interface JobConfig {
  os: RunnerOs;
  arch?: RunnerArch;
  min_vcpu?: number;
  estimate_minutes?: number;
  providers?: string[];
  runner?: string | string[];
}

export interface RunnerOption {
  provider: string;
  runner: string | string[];
  vcpu: number;
  unitPriceUsd?: number;
  quotaBurn: number;
  quotaUnit: QuotaUnit;
}

export interface Candidate {
  option: RunnerOption;
  available: number;
  paidRequired: boolean;
}

export interface RoutingDecision {
  job: string;
  provider: string;
  runner: string | string[];
  label?: string;
  runsOnJson: string;
  reason: string;
  paidRequired: boolean;
  quotaUnit: QuotaUnit;
  quotaBurn: number;
  available: number;
}

type RunnerOs = "linux" | "windows" | "macos";
type RunnerArch = "x64" | "arm64";
type PaidPolicy = "avoid" | "allow" | "forbid";
type QuotaUnit = "minutes" | "usd" | "unit_minutes" | "unlimited";
interface FreelaneConfig {
    version: 1;
    defaults?: DefaultsConfig;
    providers: Record<string, ProviderConfig>;
    jobs: Record<string, JobConfig>;
}
interface DefaultsConfig {
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
interface ProviderConfig {
    enabled?: boolean;
    free_minutes_per_month?: number;
    free_credit_usd_per_month?: number;
    unit_minutes_per_month?: number;
    used_minutes?: number;
    used_credit_usd?: number;
    used_unit_minutes?: number;
    runner?: string | string[];
    profile?: string;
}
interface JobConfig {
    os: RunnerOs;
    arch?: RunnerArch;
    min_vcpu?: number;
    estimate_minutes?: number;
    providers?: string[];
    runner?: string | string[];
}
interface RunnerOption {
    provider: string;
    runner: string | string[];
    vcpu: number;
    unitPriceUsd?: number;
    quotaBurn: number;
    quotaUnit: QuotaUnit;
}
interface Candidate {
    option: RunnerOption;
    available: number;
    paidRequired: boolean;
}
interface RoutingDecision {
    job: string;
    provider: string;
    runner: string | string[];
    runsOnJson: string;
    reason: string;
    paidRequired: boolean;
    quotaUnit: QuotaUnit;
    quotaBurn: number;
    available: number;
}

declare function findConfigPath(cwd?: string): string;
declare function loadConfig(path?: string): FreelaneConfig;

declare function formatDecision(decision: RoutingDecision, format: string): string;

type ProviderFactory = (provider: ProviderConfig, job: JobConfig) => RunnerOption | undefined;
declare const providerFactories: Record<string, ProviderFactory>;
declare function getRunnerOption(providerId: string, provider: ProviderConfig, job: JobConfig): RunnerOption | undefined;

declare function resolveFreelane(config: FreelaneConfig, jobId: string): RoutingDecision;

export { type Candidate, type DefaultsConfig, type FreelaneConfig, type JobConfig, type PaidPolicy, type ProviderConfig, type QuotaUnit, type RoutingDecision, type RunnerArch, type RunnerOption, type RunnerOs, findConfigPath, formatDecision, getRunnerOption, loadConfig, providerFactories, resolveFreelane };

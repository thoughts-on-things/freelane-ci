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
    owner?: string;
    scope?: "user" | "org" | "enterprise";
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
    label?: string;
    runsOnJson: string;
    reason: string;
    paidRequired: boolean;
    quotaUnit: QuotaUnit;
    quotaBurn: number;
    available: number;
}

type DoctorStatus = "ok" | "disabled" | "missing" | "unsupported" | "quota-low";
interface DoctorEntry {
    job: string;
    provider: string;
    status: DoctorStatus;
    runner?: string | string[];
    quotaUnit?: QuotaUnit;
    quotaBurn?: number;
    available?: number;
    message: string;
}
interface DoctorReport {
    entries: DoctorEntry[];
}
declare function doctorConfig(config: FreelaneConfig): DoctorReport;
declare function formatDoctor(report: DoctorReport, format: string): string;

declare function findConfigPath(cwd?: string): string;
declare function loadConfig(path?: string): FreelaneConfig;

declare const CONFIG_SCHEMA_URL = "https://raw.githubusercontent.com/thoughts-on-things/freelane-ci/main/schemas/freelane.schema.json";

declare function formatDecision(decision: RoutingDecision, format: string): string;

interface GitHubUsageOptions {
    repo: string;
    token?: string;
    days?: number;
    limit?: number;
    output?: string;
    apiUrl?: string;
    now?: Date;
    fetchImpl?: FetchLike;
}
interface GitHubUsageJob {
    runId: number;
    jobId: number;
    name: string;
    workflowName?: string;
    conclusion?: string;
    provider: string;
    labels: string[];
    startedAt: string;
    completedAt: string;
    durationMinutes: number;
}
interface GitHubUsageProviderTotal {
    jobs: number;
    minutes: number;
}
interface GitHubUsageState {
    source: "github-actions";
    repository: string;
    generatedAt: string;
    since: string;
    runCount: number;
    jobCount: number;
    providers: Record<string, GitHubUsageProviderTotal>;
    jobs: GitHubUsageJob[];
}
type FetchLike = (url: string, init?: {
    headers?: Record<string, string>;
}) => Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    json(): Promise<unknown>;
}>;
declare function collectGitHubUsage(options: GitHubUsageOptions): Promise<GitHubUsageState>;
declare function writeGitHubUsageState(state: GitHubUsageState, output?: string): string;
declare function formatGitHubUsageState(state: GitHubUsageState, format: string): string;
declare function inferProvider(labels: string[], runnerName?: string, runnerGroupName?: string): string;

interface InitOptions {
    output?: string;
    force?: boolean;
    cwd?: string;
}
declare function starterConfig(): string;
declare function writeStarterConfig(options?: InitOptions): string;

interface PlanResult {
    decisions: PlanDecision[];
}
interface PlanDecision extends RoutingDecision {
    remaining: number;
}
declare function planFreelane(config: FreelaneConfig, jobIds?: string[]): PlanResult;
declare function formatPlan(plan: PlanResult, format: string): string;

interface ProviderSummary {
    id: string;
    name: string;
    adapter: string;
    quota: string;
    notes: string;
}
declare function listProviders(): ProviderSummary[];
declare function formatProviderList(items: ProviderSummary[], format: string): string;

type ProviderFactory = (provider: ProviderConfig, job: JobConfig) => RunnerOption | undefined;
declare const providerFactories: Record<string, ProviderFactory>;
declare function getRunnerOption(providerId: string, provider: ProviderConfig, job: JobConfig): RunnerOption | undefined;

interface QuotaSnapshot {
    total: number;
    used: number;
    available: number;
}
declare function quotaFor(provider: ProviderConfig, unit: QuotaUnit, reserve?: number): QuotaSnapshot;
declare function displayUnit(unit: QuotaUnit): string;
declare function roundQuota(value: number): number;

declare function resolveFreelane(config: FreelaneConfig, jobId: string): RoutingDecision;

interface ConfigValidationIssue {
    path: string;
    message: string;
}
interface ConfigValidationResult {
    valid: boolean;
    path: string;
    issues: ConfigValidationIssue[];
}
declare function validateConfigFile(path?: string): ConfigValidationResult;
declare function formatValidation(result: ConfigValidationResult, format: string): string;

type UsageAmount = number | "unlimited";
interface UsageEntry {
    provider: string;
    enabled: boolean;
    quotaUnit: QuotaUnit;
    total: UsageAmount;
    used: number;
    reserve: number;
    available: UsageAmount;
}
interface UsageReport {
    entries: UsageEntry[];
}
declare function usageReport(config: FreelaneConfig): UsageReport;
declare function formatUsageReport(report: UsageReport, format: string): string;

declare const DEFAULT_USAGE_STATE = ".freelane-usage.json";
interface UsageStateOptions {
    path?: string;
    disabled?: boolean;
}
declare function loadUsageState(path?: string): GitHubUsageState;
declare function applyUsageState(config: FreelaneConfig, state: GitHubUsageState): FreelaneConfig;
declare function applyUsageStateIfPresent(config: FreelaneConfig, options?: UsageStateOptions): FreelaneConfig;

export { CONFIG_SCHEMA_URL, type Candidate, DEFAULT_USAGE_STATE, type DefaultsConfig, type FreelaneConfig, type JobConfig, type PaidPolicy, type ProviderConfig, type QuotaUnit, type RoutingDecision, type RunnerArch, type RunnerOption, type RunnerOs, applyUsageState, applyUsageStateIfPresent, collectGitHubUsage, displayUnit, doctorConfig, findConfigPath, formatDecision, formatDoctor, formatGitHubUsageState, formatPlan, formatProviderList, formatUsageReport, formatValidation, getRunnerOption, inferProvider, listProviders, loadConfig, loadUsageState, planFreelane, providerFactories, quotaFor, resolveFreelane, roundQuota, starterConfig, usageReport, validateConfigFile, writeGitHubUsageState, writeStarterConfig };

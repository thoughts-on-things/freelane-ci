import type { JobConfig } from "./types";
export interface GitHubUsageOptions {
    repo: string;
    token?: string;
    days?: number;
    limit?: number;
    output?: string;
    apiUrl?: string;
    now?: Date;
    since?: Date;
    fetchImpl?: FetchLike;
}
export interface GitHubUsageJob {
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
export interface GitHubUsageProviderTotal {
    jobs: number;
    minutes: number;
}
export interface DurationEstimate {
    samples: number;
    p50: number;
    p75: number;
    p90: number;
}
export interface GitHubDurationEstimates {
    names: Record<string, DurationEstimate>;
    platforms: Record<string, DurationEstimate>;
}
export interface GitHubUsageState {
    source: "github-actions";
    repository: string;
    generatedAt: string;
    since: string;
    runCount: number;
    jobCount: number;
    providers: Record<string, GitHubUsageProviderTotal>;
    jobs: GitHubUsageJob[];
    estimates?: GitHubDurationEstimates;
}
type FetchLike = (url: string, init?: {
    headers?: Record<string, string>;
}) => Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    json(): Promise<unknown>;
}>;
export declare function collectGitHubUsage(options: GitHubUsageOptions): Promise<GitHubUsageState>;
export declare function learnedEstimateMinutes(jobId: string, job: JobConfig, state: GitHubUsageState): number | undefined;
export declare function writeGitHubUsageState(state: GitHubUsageState, output?: string): string;
export declare function formatGitHubUsageState(state: GitHubUsageState, format: string): string;
export declare function inferProvider(labels: string[], runnerName?: string, runnerGroupName?: string): string;
export {};

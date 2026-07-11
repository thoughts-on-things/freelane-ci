import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { roundQuota } from "./quota";
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

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}>;

interface WorkflowRun {
  id: number;
}

interface WorkflowRunsResponse {
  workflow_runs?: WorkflowRun[];
}

interface WorkflowJob {
  id: number;
  run_id: number;
  name: string;
  workflow_name?: string;
  conclusion?: string;
  labels?: string[];
  runner_name?: string;
  runner_group_name?: string;
  started_at?: string;
  completed_at?: string;
}

interface WorkflowJobsResponse {
  jobs?: WorkflowJob[];
}

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 50;

export async function collectGitHubUsage(options: GitHubUsageOptions): Promise<GitHubUsageState> {
  const repository = normalizeRepo(options.repo);
  const [owner, repo] = repository.split("/");
  const apiUrl = (options.apiUrl ?? "https://api.github.com").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const days = options.days ?? DEFAULT_DAYS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const since = options.since ?? new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const headers = githubHeaders(options.token);

  const runs = await listRuns({ apiUrl, owner, repo, since, limit, headers, fetchImpl });
  const jobs: GitHubUsageJob[] = [];

  for (const run of runs) {
    const runJobs = await listJobs({ apiUrl, owner, repo, runId: run.id, headers, fetchImpl });
    for (const job of runJobs) {
      const usageJob = usageJobFromWorkflowJob(job);
      if (usageJob) jobs.push(usageJob);
    }
  }

  return {
    source: "github-actions",
    repository,
    generatedAt: now.toISOString(),
    since: since.toISOString(),
    runCount: runs.length,
    jobCount: jobs.length,
    providers: providerTotals(jobs),
    jobs,
    estimates: durationEstimates(jobs)
  };
}

export function learnedEstimateMinutes(
  jobId: string,
  job: JobConfig,
  state: GitHubUsageState
): number | undefined {
  const estimates = state.estimates ?? durationEstimates(state.jobs);
  const normalized = normalizeJobName(jobId);
  const exact = Object.entries(estimates.names)
    .filter(([name]) => name === normalized || name.startsWith(`${normalized} (`) || name.startsWith(`${normalized} /`))
    .map(([, estimate]) => estimate);
  if (exact.length) return Math.max(...exact.map((estimate) => estimate.p75));
  return estimates.platforms[platformForJob(job)]?.p75;
}

export function writeGitHubUsageState(state: GitHubUsageState, output = ".freelane-usage.json"): string {
  const path = resolve(output);
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return path;
}

export function formatGitHubUsageState(state: GitHubUsageState, format: string): string {
  if (format === "json") return `${JSON.stringify(state, null, 2)}\n`;

  const rows = Object.entries(state.providers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([provider, total]) => `${provider}\t${total.jobs}\t${total.minutes}`);

  return [
    `repository\t${state.repository}`,
    `since\t${state.since}`,
    `runs\t${state.runCount}`,
    `jobs\t${state.jobCount}`,
    "",
    "provider\tjobs\tminutes",
    ...rows
  ].join("\n") + "\n";
}

export function inferProvider(labels: string[], runnerName = "", runnerGroupName = ""): string {
  const haystack = [...labels, runnerName, runnerGroupName].join(" ").toLowerCase();

  if (haystack.includes("blacksmith")) return "blacksmith";
  if (haystack.includes("ubicloud")) return "ubicloud";
  if (haystack.includes("warpbuild") || /\bwarp-/.test(haystack)) return "warpbuild";
  if (haystack.includes("namespace") || haystack.includes("nscloud")) return "namespace";
  if (labels.some((label) => isGitHubHostedLabel(label))) return "github";
  return "unknown";
}

function usageJobFromWorkflowJob(job: WorkflowJob): GitHubUsageJob | undefined {
  if (!job.started_at || !job.completed_at) return undefined;

  const started = Date.parse(job.started_at);
  const completed = Date.parse(job.completed_at);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return undefined;

  const labels = job.labels ?? [];
  const durationMinutes = roundQuota((completed - started) / 60000);

  return {
    runId: job.run_id,
    jobId: job.id,
    name: job.name,
    workflowName: job.workflow_name,
    conclusion: job.conclusion,
    provider: inferProvider(labels, job.runner_name, job.runner_group_name),
    labels,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    durationMinutes
  };
}

function providerTotals(jobs: GitHubUsageJob[]): Record<string, GitHubUsageProviderTotal> {
  const totals: Record<string, GitHubUsageProviderTotal> = {};

  for (const job of jobs) {
    const total = totals[job.provider] ?? { jobs: 0, minutes: 0 };
    total.jobs += 1;
    total.minutes = roundQuota(total.minutes + quotaMinutes(job));
    totals[job.provider] = total;
  }

  return totals;
}

function durationEstimates(jobs: GitHubUsageJob[]): GitHubDurationEstimates {
  const names = new Map<string, number[]>();
  const platforms = new Map<string, number[]>();
  for (const job of jobs) {
    if (job.conclusion && job.conclusion !== "success") continue;
    if (/^(choose runners|freelane|route workflow jobs)$/i.test(job.name)) continue;
    addSample(names, normalizeJobName(job.name), job.durationMinutes);
    const platform = platformForLabels(job.labels);
    if (platform) addSample(platforms, platform, job.durationMinutes);
  }
  return {
    names: Object.fromEntries([...names].map(([key, values]) => [key, estimate(values)])),
    platforms: Object.fromEntries([...platforms].map(([key, values]) => [key, estimate(values)]))
  };
}

function addSample(groups: Map<string, number[]>, key: string, value: number): void {
  if (!key || value <= 0) return;
  const values = groups.get(key) ?? [];
  values.push(value);
  groups.set(key, values);
}

function estimate(values: number[]): DurationEstimate {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    samples: sorted.length,
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9)
  };
}

function percentile(sorted: number[], quantile: number): number {
  return roundQuota(sorted[Math.max(0, Math.ceil(sorted.length * quantile) - 1)] ?? 0);
}

function normalizeJobName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function platformForJob(job: JobConfig): string {
  return `${job.os}:${job.arch ?? "x64"}`;
}

function platformForLabels(labels: string[]): string | undefined {
  const value = labels.join(" ").toLowerCase();
  const os = /windows/.test(value) ? "windows" : /macos/.test(value) ? "macos" : /ubuntu|linux/.test(value) ? "linux" : undefined;
  if (!os) return undefined;
  const arch = /(?:arm64|ubuntu-(?:2204|2404|24\.04)-arm|ubuntu-\d+-arm)/.test(value) || os === "macos" ? "arm64" : "x64";
  return `${os}:${arch}`;
}

function quotaMinutes(job: GitHubUsageJob): number {
  if (job.provider === "github") {
    const labels = job.labels.join(" ").toLowerCase();
    const multiplier = labels.includes("windows") ? 2 : labels.includes("macos") ? 10 : 1;
    return roundQuota(job.durationMinutes * multiplier);
  }
  if (job.provider !== "blacksmith") return job.durationMinutes;
  const label = job.labels.find((value) => value.startsWith("blacksmith-"));
  const match = label && /^blacksmith-(\d+)vcpu-(ubuntu-[^-]+(?:-arm)?|windows-|macos-)/.exec(label);
  if (!match) return job.durationMinutes;
  const vcpuRatio = Math.max(1, Number(match[1]) / 2);
  const platform = match[2];
  const priceRatio = platform.endsWith("-arm") ? 0.625 : platform.startsWith("windows-") ? 2 : platform.startsWith("macos-") ? 20 / 3 : 1;
  return roundQuota(job.durationMinutes * vcpuRatio * priceRatio);
}

async function listRuns(options: {
  apiUrl: string;
  owner: string;
  repo: string;
  since: Date;
  limit: number;
  headers: Record<string, string>;
  fetchImpl: FetchLike;
}): Promise<WorkflowRun[]> {
  const runs: WorkflowRun[] = [];
  let page = 1;

  while (runs.length < options.limit) {
    const perPage = Math.min(100, options.limit - runs.length);
    const url = new URL(`${options.apiUrl}/repos/${options.owner}/${options.repo}/actions/runs`);
    url.searchParams.set("status", "completed");
    url.searchParams.set("created", `>=${options.since.toISOString()}`);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    const response = await requestJson<WorkflowRunsResponse>(options.fetchImpl, url.toString(), options.headers);
    const pageRuns = response.workflow_runs ?? [];
    runs.push(...pageRuns);
    if (pageRuns.length < perPage) break;
    page += 1;
  }

  return runs;
}

async function listJobs(options: {
  apiUrl: string;
  owner: string;
  repo: string;
  runId: number;
  headers: Record<string, string>;
  fetchImpl: FetchLike;
}): Promise<WorkflowJob[]> {
  const jobs: WorkflowJob[] = [];
  let page = 1;

  while (true) {
    const url = new URL(`${options.apiUrl}/repos/${options.owner}/${options.repo}/actions/runs/${options.runId}/jobs`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await requestJson<WorkflowJobsResponse>(options.fetchImpl, url.toString(), options.headers);
    const pageJobs = response.jobs ?? [];
    jobs.push(...pageJobs);
    if (pageJobs.length < 100) break;
    page += 1;
  }

  return jobs;
}

async function requestJson<T>(fetchImpl: FetchLike, url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function githubHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "freelane-ci"
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function normalizeRepo(repo: string): string {
  if (!/^[^/]+\/[^/]+$/.test(repo)) {
    throw new Error("--repo must use owner/repo");
  }
  return repo;
}

function isGitHubHostedLabel(label: string): boolean {
  return /^(ubuntu|windows|macos)-/.test(label.toLowerCase());
}

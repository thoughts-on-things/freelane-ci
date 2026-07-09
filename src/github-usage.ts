import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { roundQuota } from "./quota";

export interface GitHubUsageOptions {
  repo: string;
  token?: string;
  days?: number;
  limit?: number;
  output?: string;
  apiUrl?: string;
  now?: Date;
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

export interface GitHubUsageState {
  source: "github-actions";
  repository: string;
  generatedAt: string;
  since: string;
  runCount: number;
  jobCount: number;
  providers: Record<string, GitHubUsageProviderTotal>;
  jobs: GitHubUsageJob[];
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
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
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
    jobs
  };
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
    total.minutes = roundQuota(total.minutes + job.durationMinutes);
    totals[job.provider] = total;
  }

  return totals;
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

import type { Candidate, FreelaneConfig, JobConfig, ProviderConfig, RoutingDecision } from "./types";
import { getRunnerOption } from "./providers";

export function resolveFreelane(config: FreelaneConfig, jobId: string): RoutingDecision {
  const job = config.jobs[jobId];
  if (!job) throw new Error(`unknown job: ${jobId}`);

  if (job.runner) {
    return directDecision(jobId, job);
  }

  const providerIds = job.providers ?? Object.keys(config.providers);
  const candidates = providerIds
    .map((id) => candidateFor(config, id, job))
    .filter((candidate): candidate is Candidate => Boolean(candidate));

  if (candidates.length === 0) {
    throw new Error(`no enabled provider can satisfy job: ${jobId}`);
  }

  const free = candidates.find((candidate) => !candidate.paidRequired);
  if (free) return decision(jobId, free, `selected ${free.option.provider} within configured free quota`);

  const fallback = fallbackCandidate(config, job, candidates);
  if (fallback) return decision(jobId, fallback, `fallback to ${fallback.option.provider}; free quota unavailable`);

  const paid = config.defaults?.paid ?? "avoid";
  if (paid === "forbid") {
    throw new Error(`free quota unavailable for job: ${jobId}`);
  }

  return decision(jobId, candidates[0], `selected ${candidates[0].option.provider}; free quota unavailable`);
}

function candidateFor(config: FreelaneConfig, providerId: string, job: JobConfig): Candidate | undefined {
  const provider = config.providers[providerId];
  if (!provider || provider.enabled === false) return undefined;

  const option = getRunnerOption(providerId, provider, job);
  if (!option) return undefined;

  const quota = quotaFor(provider, option.quotaUnit);
  const reserve = config.defaults?.reserve?.[providerId] ?? 0;
  const available = quota.total - quota.used - reserve;
  const paidRequired = quota.total !== Number.POSITIVE_INFINITY && available < option.quotaBurn;

  return { option, available, paidRequired };
}

function fallbackCandidate(config: FreelaneConfig, job: JobConfig, candidates: Candidate[]): Candidate | undefined {
  const fallbackIds = config.defaults?.fallback?.providers ?? [];
  for (const id of fallbackIds) {
    const existing = candidates.find((candidate) => candidate.option.provider === id);
    if (existing) return existing;
    const fallback = candidateFor(config, id, job);
    if (fallback) return fallback;
  }
  return undefined;
}

function quotaFor(provider: ProviderConfig, unit: Candidate["option"]["quotaUnit"]): { total: number; used: number } {
  if (provider.free_credit_usd_per_month !== undefined) {
    return { total: provider.free_credit_usd_per_month, used: provider.used_credit_usd ?? 0 };
  }
  if (provider.free_minutes_per_month !== undefined) {
    return { total: provider.free_minutes_per_month, used: provider.used_minutes ?? 0 };
  }
  if (provider.unit_minutes_per_month !== undefined || unit === "unit_minutes") {
    return { total: provider.unit_minutes_per_month ?? 0, used: provider.used_unit_minutes ?? 0 };
  }
  return { total: Number.POSITIVE_INFINITY, used: 0 };
}

function decision(jobId: string, candidate: Candidate, reason: string): RoutingDecision {
  const runner = candidate.option.runner;
  return {
    job: jobId,
    provider: candidate.option.provider,
    runner,
    runsOnJson: JSON.stringify(runner),
    reason,
    paidRequired: candidate.paidRequired,
    quotaUnit: candidate.option.quotaUnit,
    quotaBurn: round(candidate.option.quotaBurn),
    available: round(candidate.available)
  };
}

function directDecision(jobId: string, job: JobConfig): RoutingDecision {
  const runner = job.runner ?? "ubuntu-latest";
  return {
    job: jobId,
    provider: "manual",
    runner,
    runsOnJson: JSON.stringify(runner),
    reason: "selected job-specific runner",
    paidRequired: false,
    quotaUnit: "unlimited",
    quotaBurn: 0,
    available: Number.POSITIVE_INFINITY
  };
}

function round(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10000) / 10000;
}

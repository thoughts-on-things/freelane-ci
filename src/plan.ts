import { displayUnit, roundQuota } from "./quota";
import { resolveFreelane } from "./resolve";
import type { FreelaneConfig, ProviderConfig, QuotaUnit, RoutingDecision } from "./types";

export interface PlanResult {
  decisions: PlanDecision[];
}

export interface PlanDecision extends RoutingDecision {
  remaining: number;
}

export function planFreelane(config: FreelaneConfig, jobIds = Object.keys(config.jobs)): PlanResult {
  const working = copyConfig(config);
  const decisions = jobIds.map((jobId) => {
    const decision = resolveFreelane(working, jobId);
    const planned = {
      ...decision,
      remaining: remainingAfter(decision.available, decision.quotaBurn)
    };
    consumeQuota(working.providers[decision.provider], decision.quotaUnit, decision.quotaBurn);
    return planned;
  });

  return { decisions };
}

export function formatPlan(plan: PlanResult, format: string): string {
  if (format === "json") return `${JSON.stringify(plan, null, 2)}\n`;

  return [
    "job\tprovider\trunner\tburn\tremaining\treason",
    ...plan.decisions.map((decision) => [
      decision.job,
      decision.provider,
      decision.runsOnJson,
      `${decision.quotaBurn} ${displayUnit(decision.quotaUnit)}`,
      `${decision.remaining} ${displayUnit(decision.quotaUnit)}`,
      decision.reason
    ].join("\t"))
  ].join("\n") + "\n";
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

function consumeQuota(provider: ProviderConfig | undefined, unit: QuotaUnit, burn: number): void {
  if (!provider || unit === "unlimited" || burn <= 0 || !Number.isFinite(burn)) return;

  if (unit === "usd") {
    provider.used_credit_usd = roundQuota((provider.used_credit_usd ?? 0) + burn);
  } else if (unit === "unit_minutes") {
    provider.used_unit_minutes = roundQuota((provider.used_unit_minutes ?? 0) + burn);
  } else {
    provider.used_minutes = roundQuota((provider.used_minutes ?? 0) + burn);
  }
}

function remainingAfter(available: number, burn: number): number {
  if (!Number.isFinite(available)) return available;
  return roundQuota(available - burn);
}

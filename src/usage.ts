import { displayUnit, quotaFor, quotaUnitForProvider, roundQuota } from "./quota";
import type { FreelaneConfig, QuotaUnit } from "./types";

export type UsageAmount = number | "unlimited";

export interface UsageEntry {
  provider: string;
  enabled: boolean;
  quotaUnit: QuotaUnit;
  total: UsageAmount;
  used: number;
  reserve: number;
  available: UsageAmount;
}

export interface UsageReport {
  entries: UsageEntry[];
}

export function usageReport(config: FreelaneConfig): UsageReport {
  const entries = Object.entries(config.providers).map(([providerId, provider]) => {
    const quotaUnit = quotaUnitForProvider(provider);
    const reserve = config.defaults?.reserve?.[providerId] ?? 0;
    const quota = quotaFor(provider, quotaUnit, reserve);

    return {
      provider: providerId,
      enabled: provider.enabled !== false,
      quotaUnit,
      total: usageAmount(quota.total),
      used: roundQuota(quota.used),
      reserve: roundQuota(reserve),
      available: usageAmount(quota.available)
    };
  });

  return { entries };
}

export function formatUsageReport(report: UsageReport, format: string): string {
  if (format === "json") return `${JSON.stringify(report, null, 2)}\n`;

  return [
    "provider\tenabled\ttotal\tused\treserve\tavailable",
    ...report.entries.map((entry) => [
      entry.provider,
      String(entry.enabled),
      formatAmount(entry.total, entry.quotaUnit),
      formatAmount(entry.used, entry.quotaUnit),
      formatAmount(entry.reserve, entry.quotaUnit),
      formatAmount(entry.available, entry.quotaUnit)
    ].join("\t"))
  ].join("\n") + "\n";
}

function usageAmount(value: number): UsageAmount {
  if (!Number.isFinite(value)) return "unlimited";
  return roundQuota(value);
}

function formatAmount(value: UsageAmount, unit: QuotaUnit): string {
  if (value === "unlimited") return value;
  if (unit === "unlimited") return String(value);
  return `${value} ${displayUnit(unit)}`;
}

import type { ProviderConfig, QuotaUnit } from "./types";

export interface QuotaSnapshot {
  total: number;
  used: number;
  available: number;
}

export function quotaFor(provider: ProviderConfig, unit: QuotaUnit, reserve = 0): QuotaSnapshot {
  const quota = rawQuotaFor(provider, unit);
  return {
    ...quota,
    available: quota.total - quota.used - reserve
  };
}

function rawQuotaFor(provider: ProviderConfig, unit: QuotaUnit): Omit<QuotaSnapshot, "available"> {
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

export function displayUnit(unit: QuotaUnit): string {
  if (unit === "usd") return "usd";
  if (unit === "unit_minutes") return "unit-min";
  if (unit === "minutes") return "min";
  return "unlimited";
}

export function roundQuota(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10000) / 10000;
}

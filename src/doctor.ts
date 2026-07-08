import type { FreelaneConfig, QuotaUnit } from "./types";
import { getRunnerOption } from "./providers";
import { displayUnit, quotaFor, roundQuota } from "./quota";

export type DoctorStatus = "ok" | "disabled" | "missing" | "unsupported" | "quota-low";

export interface DoctorEntry {
  job: string;
  provider: string;
  status: DoctorStatus;
  runner?: string | string[];
  quotaUnit?: QuotaUnit;
  quotaBurn?: number;
  available?: number;
  message: string;
}

export interface DoctorReport {
  entries: DoctorEntry[];
}

export function doctorConfig(config: FreelaneConfig): DoctorReport {
  const entries: DoctorEntry[] = [];

  for (const [jobId, job] of Object.entries(config.jobs)) {
    const providerIds = job.providers ?? Object.keys(config.providers);

    for (const providerId of providerIds) {
      const provider = config.providers[providerId];
      if (!provider) {
        entries.push({ job: jobId, provider: providerId, status: "missing", message: "provider is not configured" });
        continue;
      }
      if (provider.enabled === false) {
        entries.push({ job: jobId, provider: providerId, status: "disabled", message: "provider is disabled" });
        continue;
      }

      const option = getRunnerOption(providerId, provider, job);
      if (!option) {
        entries.push({ job: jobId, provider: providerId, status: "unsupported", message: "no runner matches job requirements" });
        continue;
      }

      const reserve = config.defaults?.reserve?.[providerId] ?? 0;
      const quota = quotaFor(provider, option.quotaUnit, reserve);
      const quotaBurn = roundQuota(option.quotaBurn);
      const available = roundQuota(quota.available);
      const status = quota.total !== Number.POSITIVE_INFINITY && quota.available < option.quotaBurn ? "quota-low" : "ok";
      const unit = displayUnit(option.quotaUnit);

      entries.push({
        job: jobId,
        provider: providerId,
        status,
        runner: option.runner,
        quotaUnit: option.quotaUnit,
        quotaBurn,
        available,
        message: status === "ok" ? `burns ${quotaBurn} ${unit}; ${available} available` : `needs ${quotaBurn} ${unit}; ${available} available`
      });
    }
  }

  return { entries };
}

export function formatDoctor(report: DoctorReport, format: string): string {
  if (format === "json") return `${JSON.stringify(report, null, 2)}\n`;

  return report.entries
    .map((entry) => {
      const runner = entry.runner ? JSON.stringify(entry.runner) : "-";
      return `${entry.status}\t${entry.job}\t${entry.provider}\t${runner}\t${entry.message}`;
    })
    .join("\n") + "\n";
}

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
export declare function usageReport(config: FreelaneConfig): UsageReport;
export declare function formatUsageReport(report: UsageReport, format: string): string;

import type { ProviderConfig, QuotaUnit } from "./types";
export interface QuotaSnapshot {
    total: number;
    used: number;
    available: number;
}
export declare function quotaFor(provider: ProviderConfig, unit: QuotaUnit, reserve?: number): QuotaSnapshot;
export declare function quotaUnitForProvider(provider: ProviderConfig, fallback?: QuotaUnit): QuotaUnit;
export declare function displayUnit(unit: QuotaUnit): string;
export declare function roundQuota(value: number): number;

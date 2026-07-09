import type { FreelaneConfig, QuotaUnit } from "./types";
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
export declare function doctorConfig(config: FreelaneConfig): DoctorReport;
export declare function formatDoctor(report: DoctorReport, format: string): string;

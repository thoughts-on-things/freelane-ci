import type { FreelaneConfig, RoutingDecision } from "./types";
export interface PlanResult {
    decisions: PlanDecision[];
}
export interface PlanDecision extends RoutingDecision {
    remaining: number;
}
export declare function planFreelane(config: FreelaneConfig, jobIds?: string[]): PlanResult;
export declare function formatPlan(plan: PlanResult, format: string): string;

import { type GitHubUsageState } from "./github-usage";
import type { FreelaneConfig } from "./types";
export declare const DEFAULT_USAGE_STATE = ".freelane-usage.json";
export interface UsageStateOptions {
    path?: string;
    disabled?: boolean;
}
export declare function loadUsageState(path?: string): GitHubUsageState;
export declare function applyUsageState(config: FreelaneConfig, state: GitHubUsageState): FreelaneConfig;
export declare function applyUsageStateIfPresent(config: FreelaneConfig, options?: UsageStateOptions): FreelaneConfig;

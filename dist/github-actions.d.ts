import type { FreelaneConfig } from "./types";
export declare const DEFAULT_WORKFLOW_OUTPUT = ".github/workflows/freelane-ci.yml";
export declare const DEFAULT_ACTION_REF = "thoughts-on-things/freelane-ci@v0";
export interface GitHubActionsWorkflowOptions {
    configPath?: string;
    uses?: string;
    workflowName?: string;
}
export interface WriteGitHubActionsWorkflowOptions extends GitHubActionsWorkflowOptions {
    cwd?: string;
    force?: boolean;
    output?: string;
}
export interface MigrateGitHubActionsOptions extends GitHubActionsWorkflowOptions {
    cwd?: string;
    dryRun?: boolean;
    force?: boolean;
    jobMap?: Record<string, string>;
    workflow: string;
}
export interface WorkflowAlias {
    job: string;
    alias: string;
}
export interface GitHubActionsMigration {
    changed: boolean;
    content: string;
    routed: MigratedJob[];
    skipped: SkippedJob[];
    workflow: string;
}
export interface MigratedJob {
    alias: string;
    freelaneJob: string;
    runner: string;
    workflowJob: string;
}
export interface SkippedJob {
    reason: string;
    workflowJob: string;
}
export declare function githubActionsAliases(config: FreelaneConfig): WorkflowAlias[];
export declare function generateGitHubActionsWorkflow(config: FreelaneConfig, options?: GitHubActionsWorkflowOptions): string;
export declare function writeGitHubActionsWorkflow(config: FreelaneConfig, options?: WriteGitHubActionsWorkflowOptions): string;
export declare function migrateGitHubActionsWorkflow(config: FreelaneConfig, options: MigrateGitHubActionsOptions): GitHubActionsMigration;
export declare function migrateGitHubActionsWorkflowContent(config: FreelaneConfig, raw: string, options?: Omit<MigrateGitHubActionsOptions, "workflow" | "cwd">): GitHubActionsMigration;
export declare function sanitizeOutputName(value: string): string;

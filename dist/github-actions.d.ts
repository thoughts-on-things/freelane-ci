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
export interface WorkflowAlias {
    job: string;
    alias: string;
}
export declare function githubActionsAliases(config: FreelaneConfig): WorkflowAlias[];
export declare function generateGitHubActionsWorkflow(config: FreelaneConfig, options?: GitHubActionsWorkflowOptions): string;
export declare function writeGitHubActionsWorkflow(config: FreelaneConfig, options?: WriteGitHubActionsWorkflowOptions): string;
export declare function sanitizeOutputName(value: string): string;

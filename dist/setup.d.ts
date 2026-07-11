export type GitHubPlan = "public" | "free" | "pro" | "team" | "enterprise";
export interface SetupGitHubActionsOptions {
    configPath?: string;
    cwd?: string;
    force?: boolean;
    githubMinutes?: number;
    githubPlan?: GitHubPlan;
    providers?: string[];
    uses?: string;
    workflows: string[];
}
export interface SetupGitHubActionsResult {
    config: string;
    jobs: number;
    skipped: Array<{
        reason: string;
        workflowJob: string;
        workflow: string;
    }>;
    workflows: Array<{
        path: string;
        routed: number;
    }>;
}
export declare function setupGitHubActions(options: SetupGitHubActionsOptions): SetupGitHubActionsResult;

import type { JobConfig, ProviderConfig, RunnerOption } from "./types";
type ProviderFactory = (provider: ProviderConfig, job: JobConfig) => RunnerOption | undefined;
export declare const providerFactories: Record<string, ProviderFactory>;
export declare function getRunnerOption(providerId: string, provider: ProviderConfig, job: JobConfig): RunnerOption | undefined;
export {};

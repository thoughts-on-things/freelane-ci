export interface InitOptions {
    output?: string;
    force?: boolean;
    cwd?: string;
}
export declare function starterConfig(): string;
export declare function writeStarterConfig(options?: InitOptions): string;

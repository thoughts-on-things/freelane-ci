export interface ConfigValidationIssue {
    path: string;
    message: string;
}
export interface ConfigValidationResult {
    valid: boolean;
    path: string;
    issues: ConfigValidationIssue[];
}
export declare function validateConfigFile(path?: string): ConfigValidationResult;
export declare function formatValidation(result: ConfigValidationResult, format: string): string;

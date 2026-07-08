import Ajv2020 from "ajv/dist/2020";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import schema from "../schemas/freelane.schema.json";
import { findConfigPath } from "./config";

export interface ConfigValidationIssue {
  path: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  path: string;
  issues: ConfigValidationIssue[];
}

export function validateConfigFile(path = findConfigPath()): ConfigValidationResult {
  const config = parse(readFileSync(path, "utf8"));
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile(schema);
  const schemaValid = validate(config);
  const issues = [
    ...(validate.errors ?? []).map((error) => ({
      path: error.instancePath || "/",
      message: error.message ?? "invalid value"
    })),
    ...semanticIssues(config)
  ];

  return {
    valid: schemaValid && issues.length === 0,
    path,
    issues
  };
}

export function formatValidation(result: ConfigValidationResult, format: string): string {
  if (format === "json") return `${JSON.stringify(result, null, 2)}\n`;
  if (result.valid) return `valid ${result.path}\n`;

  return [
    `invalid ${result.path}`,
    ...result.issues.map((issue) => `- ${issue.path} ${issue.message}`)
  ].join("\n") + "\n";
}

function semanticIssues(config: unknown): ConfigValidationIssue[] {
  if (!isRecord(config) || !isRecord(config.providers) || !isRecord(config.jobs)) return [];

  const issues: ConfigValidationIssue[] = [];
  const providerIds = new Set(Object.keys(config.providers));

  if (isRecord(config.defaults)) {
    if (isRecord(config.defaults.reserve)) {
      for (const providerId of Object.keys(config.defaults.reserve)) {
        if (!providerIds.has(providerId)) {
          issues.push({
            path: pointer("defaults", "reserve", providerId),
            message: `references unknown provider "${providerId}"`
          });
        }
      }
    }

    if (isRecord(config.defaults.fallback)) {
      issues.push(...providerReferenceIssues(config.defaults.fallback.providers, pointer("defaults", "fallback", "providers"), providerIds));
    }
  }

  for (const [jobId, job] of Object.entries(config.jobs)) {
    if (isRecord(job)) {
      issues.push(...providerReferenceIssues(job.providers, pointer("jobs", jobId, "providers"), providerIds));
    }
  }

  return issues;
}

function providerReferenceIssues(value: unknown, path: string, providerIds: Set<string>): ConfigValidationIssue[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((providerId, index) => {
    if (typeof providerId !== "string" || providerIds.has(providerId)) return [];
    return [{
      path: `${path}/${index}`,
      message: `references unknown provider "${providerId}"`
    }];
  });
}

function pointer(...segments: string[]): string {
  return `/${segments.map((segment) => segment.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

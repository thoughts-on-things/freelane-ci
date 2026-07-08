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
  const valid = validate(config);

  return {
    valid,
    path,
    issues: (validate.errors ?? []).map((error) => ({
      path: error.instancePath || "/",
      message: error.message ?? "invalid value"
    }))
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

import Ajv2020 from "ajv/dist/2020";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const schema = JSON.parse(readFileSync("schemas/freelane.schema.json", "utf8"));
const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

describe("freelane schema", () => {
  it.each([".freelane.example.yml", "examples/freelane.yml"])("validates %s", (path) => {
    const config = parse(readFileSync(path, "utf8"));

    expect(validate(config), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });
});

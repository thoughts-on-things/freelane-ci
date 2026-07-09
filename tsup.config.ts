import { defineConfig } from "tsup";

const common = {
  format: ["cjs"] as const,
  platform: "node" as const,
  target: "node20",
  clean: false
};

export default defineConfig([
  {
    ...common,
    entry: ["src/action.ts"],
    noExternal: ["@actions/core", "ajv", "yaml"]
  },
  {
    ...common,
    entry: ["src/cli.ts", "src/index.ts"],
    clean: false
  }
]);

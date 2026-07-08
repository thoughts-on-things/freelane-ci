import type { RoutingDecision } from "./types";

export function formatDecision(decision: RoutingDecision, format: string): string {
  if (format === "json") return `${JSON.stringify(decision, null, 2)}\n`;
  if (format === "github-output") {
    return [
      `runs_on=${decision.runsOnJson}`,
      `provider=${decision.provider}`,
      `runner=${JSON.stringify(decision.runner)}`,
      `reason=${decision.reason}`
    ].join("\n") + "\n";
  }
  return `${decision.provider} ${decision.runsOnJson} - ${decision.reason}\n`;
}

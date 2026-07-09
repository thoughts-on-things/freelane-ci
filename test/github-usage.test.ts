import { describe, expect, it } from "vitest";
import { collectGitHubUsage, inferProvider } from "../src/github-usage";

describe("collectGitHubUsage", () => {
  it("aggregates workflow job duration by inferred provider", async () => {
    const fetchImpl = async (url: string) => {
      if (url.includes("/actions/runs?")) {
        return jsonResponse({
          workflow_runs: [{ id: 11 }, { id: 12 }]
        });
      }
      if (url.includes("/actions/runs/11/jobs")) {
        return jsonResponse({
          jobs: [{
            id: 101,
            run_id: 11,
            name: "test-linux",
            workflow_name: "ci",
            conclusion: "success",
            labels: ["blacksmith-2vcpu-ubuntu-2404"],
            started_at: "2026-07-08T10:00:00Z",
            completed_at: "2026-07-08T10:08:00Z"
          }]
        });
      }
      if (url.includes("/actions/runs/12/jobs")) {
        return jsonResponse({
          jobs: [{
            id: 102,
            run_id: 12,
            name: "test-github",
            workflow_name: "ci",
            conclusion: "success",
            labels: ["ubuntu-latest"],
            started_at: "2026-07-08T11:00:00Z",
            completed_at: "2026-07-08T11:03:30Z"
          }]
        });
      }
      throw new Error(`unexpected URL: ${url}`);
    };

    const usage = await collectGitHubUsage({
      repo: "thoughts-on-things/freelane-ci",
      now: new Date("2026-07-08T12:00:00Z"),
      fetchImpl
    });

    expect(usage.runCount).toBe(2);
    expect(usage.jobCount).toBe(2);
    expect(usage.providers.blacksmith.minutes).toBe(8);
    expect(usage.providers.github.minutes).toBe(3.5);
  });
});

describe("inferProvider", () => {
  it.each([
    [["blacksmith-2vcpu-ubuntu-2404"], "blacksmith"],
    [["ubicloud-standard-2"], "ubicloud"],
    [["warp-ubuntu-latest-x64-2x"], "warpbuild"],
    [["nscloud-ubuntu-24.04-amd64-4x8"], "namespace"],
    [["ubuntu-latest"], "github"]
  ])("infers %s", (labels, provider) => {
    expect(inferProvider(labels)).toBe(provider);
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    async json() {
      return body;
    }
  };
}

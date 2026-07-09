import type { JobConfig, ProviderConfig, QuotaUnit, RunnerOption, RunnerOs } from "./types";
import { quotaUnitForProvider } from "./quota";

type ProviderFactory = (provider: ProviderConfig, job: JobConfig) => RunnerOption | undefined;

const VCPU_SIZES = [2, 4, 8, 16, 32];

export const providerFactories: Record<string, ProviderFactory> = {
  github: githubRunner,
  blacksmith: blacksmithRunner,
  ubicloud: ubicloudRunner,
  warpbuild: warpbuildRunner,
  namespace: namespaceRunner
};

export function getRunnerOption(
  providerId: string,
  provider: ProviderConfig,
  job: JobConfig
): RunnerOption | undefined {
  if (provider.runner) {
    return option(providerId, provider.runner, job.min_vcpu ?? 2, priceFor(providerId, job), job, quotaUnitForProvider(provider));
  }

  const factory = providerFactories[providerId];
  return factory?.(provider, job);
}

function githubRunner(_provider: ProviderConfig, job: JobConfig): RunnerOption | undefined {
  const arch = job.arch ?? "x64";
  const label = githubLabel(job.os, arch);
  if (!label) return undefined;
  return option("github", label, job.min_vcpu ?? 2, undefined, job, quotaUnitForProvider(_provider));
}

function blacksmithRunner(provider: ProviderConfig, job: JobConfig): RunnerOption | undefined {
  const arch = job.arch ?? "x64";
  const vcpu = nearestVcpu(job.min_vcpu);
  const quotaUnit = quotaUnitForProvider(provider);

  if (job.os === "linux" && arch === "x64") {
    return option("blacksmith", `blacksmith-${vcpu}vcpu-ubuntu-2404`, vcpu, priceFor("blacksmith", job), job, quotaUnit);
  }
  if (job.os === "linux" && arch === "arm64") {
    return option("blacksmith", `blacksmith-${vcpu}vcpu-ubuntu-2404-arm`, vcpu, priceFor("blacksmith", job), job, quotaUnit);
  }
  if (job.os === "windows" && arch === "x64") {
    return option("blacksmith", `blacksmith-${vcpu}vcpu-windows-2025`, vcpu, priceFor("blacksmith", job), job, quotaUnit);
  }
  if (job.os === "macos" && arch === "arm64") {
    const macVcpu = job.min_vcpu && job.min_vcpu > 6 ? 12 : 6;
    return option("blacksmith", `blacksmith-${macVcpu}vcpu-macos-15`, macVcpu, priceFor("blacksmith", job), job, quotaUnit);
  }
  return undefined;
}

function ubicloudRunner(provider: ProviderConfig, job: JobConfig): RunnerOption | undefined {
  const arch = job.arch ?? "x64";
  const vcpu = nearestVcpu(job.min_vcpu, [2, 4, 8, 16, 30]);
  const quotaUnit = quotaUnitForProvider(provider);

  if (job.os !== "linux") return undefined;
  if (arch === "x64") {
    return option("ubicloud", `ubicloud-standard-${vcpu}`, vcpu, priceFor("ubicloud", job), job, quotaUnit);
  }
  return option("ubicloud", `ubicloud-standard-${vcpu}-arm`, vcpu, priceFor("ubicloud", job), job, quotaUnit);
}

function warpbuildRunner(provider: ProviderConfig, job: JobConfig): RunnerOption | undefined {
  const arch = job.arch ?? "x64";
  const vcpu = nearestVcpu(job.min_vcpu);
  const quotaUnit = quotaUnitForProvider(provider);

  if (job.os === "linux") {
    return option("warpbuild", `warp-ubuntu-latest-${arch}-${vcpu}x`, vcpu, priceFor("warpbuild", job), job, quotaUnit);
  }
  if (job.os === "windows" && arch === "x64") {
    const winVcpu = nearestVcpu(job.min_vcpu, [4, 8, 16, 32]);
    return option("warpbuild", `warp-windows-latest-x64-${winVcpu}x`, winVcpu, priceFor("warpbuild", job), job, quotaUnit);
  }
  if (job.os === "macos" && arch === "arm64") {
    const macVcpu = job.min_vcpu && job.min_vcpu > 6 ? 12 : 6;
    return option("warpbuild", `warp-macos-latest-arm64-${macVcpu}x`, macVcpu, priceFor("warpbuild", job), job, quotaUnit);
  }
  return undefined;
}

function namespaceRunner(provider: ProviderConfig, job: JobConfig): RunnerOption | undefined {
  if (provider.profile) {
    return option("namespace", `namespace-profile-${provider.profile}`, job.min_vcpu ?? 4, undefined, job, quotaUnitForProvider(provider));
  }

  const arch = job.arch === "arm64" ? "arm64" : "amd64";
  const os = namespaceOs(job.os);
  if (!os) return undefined;
  const sizes = job.os === "macos" ? [6, 12] : [2, 4, 8, 16, 32];
  const vcpu = nearestVcpu(job.min_vcpu, sizes);
  const memory = job.os === "macos" ? (vcpu === 12 ? 28 : 14) : vcpu * 2;

  return option("namespace", `nscloud-${os}-${arch}-${vcpu}x${memory}`, vcpu, undefined, job, quotaUnitForProvider(provider, "unit_minutes"));
}

function option(
  provider: string,
  runner: string | string[],
  vcpu: number,
  unitPriceUsd: number | undefined,
  job: JobConfig,
  quotaUnit: QuotaUnit
): RunnerOption {
  const minutes = job.estimate_minutes ?? 10;
  const quotaBurn = quotaUnit === "unlimited" ? 0 : quotaUnit === "usd" ? minutes * (unitPriceUsd ?? 0) : unitBurn(provider, job.os, vcpu, minutes);
  return { provider, runner, vcpu, unitPriceUsd, quotaBurn, quotaUnit };
}

function unitBurn(provider: string, os: RunnerOs, vcpu: number, minutes: number): number {
  if (provider === "namespace") return vcpu * minutes * platformMultiplier(os);
  if (provider === "github" || provider === "blacksmith") return Math.max(1, vcpu / 2) * minutes * platformMultiplier(os);
  return minutes;
}

function platformMultiplier(os: RunnerOs): number {
  if (os === "windows") return 2;
  if (os === "macos") return 10;
  return 1;
}

function priceFor(provider: string, job: JobConfig): number | undefined {
  const arch = job.arch ?? "x64";
  if (provider === "blacksmith") {
    if (job.os === "linux" && arch === "arm64") return 0.0025;
    if (job.os === "windows") return 0.008;
    if (job.os === "macos") return 0.08;
    return 0.004;
  }
  if (provider === "ubicloud") {
    return arch === "arm64" ? 0.001 : 0.0016;
  }
  if (provider === "warpbuild") {
    if (job.os === "linux" && arch === "arm64") return 0.003;
    if (job.os === "windows") return 0.008;
    if (job.os === "macos") return 0.08;
    return 0.004;
  }
  return undefined;
}

function githubLabel(os: RunnerOs, arch: string): string | undefined {
  if (os === "linux" && arch === "x64") return "ubuntu-latest";
  if (os === "linux" && arch === "arm64") return "ubuntu-24.04-arm";
  if (os === "windows" && arch === "x64") return "windows-latest";
  if (os === "macos") return "macos-latest";
  return undefined;
}

function namespaceOs(os: RunnerOs): string | undefined {
  if (os === "linux") return "ubuntu-24.04";
  if (os === "windows") return "windows-2022";
  if (os === "macos") return "macos-sequoia";
  return undefined;
}

function nearestVcpu(min = 2, sizes = VCPU_SIZES): number {
  return sizes.find((size) => size >= min) ?? sizes[sizes.length - 1];
}

export interface ProviderSummary {
  id: string;
  name: string;
  adapter: string;
  quota: string;
  notes: string;
}

const providers: ProviderSummary[] = [
  {
    id: "github",
    name: "GitHub",
    adapter: "hosted runner labels",
    quota: "minutes or unlimited",
    notes: "default fallback"
  },
  {
    id: "blacksmith",
    name: "Blacksmith",
    adapter: "GitHub-compatible runner labels",
    quota: "minutes or usd",
    notes: "linux, windows, macos"
  },
  {
    id: "ubicloud",
    name: "Ubicloud",
    adapter: "GitHub-compatible runner labels",
    quota: "usd",
    notes: "linux"
  },
  {
    id: "warpbuild",
    name: "WarpBuild",
    adapter: "GitHub-compatible runner labels",
    quota: "usd",
    notes: "linux, windows, macos"
  },
  {
    id: "namespace",
    name: "Namespace",
    adapter: "GitHub-compatible runner labels",
    quota: "unit minutes",
    notes: "supports profiles"
  }
];

export function listProviders(): ProviderSummary[] {
  return providers.map((provider) => ({ ...provider }));
}

export function formatProviderList(items: ProviderSummary[], format: string): string {
  if (format === "json") return `${JSON.stringify({ providers: items }, null, 2)}\n`;

  return [
    "id\tname\tquota\tnotes",
    ...items.map((provider) => `${provider.id}\t${provider.name}\t${provider.quota}\t${provider.notes}`)
  ].join("\n") + "\n";
}

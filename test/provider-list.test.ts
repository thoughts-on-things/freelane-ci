import { describe, expect, it } from "vitest";
import { formatProviderList, listProviders } from "../src/provider-list";

describe("listProviders", () => {
  it("includes built-in provider adapters", () => {
    expect(listProviders().map((provider) => provider.id)).toEqual([
      "github",
      "blacksmith",
      "ubicloud",
      "warpbuild",
      "namespace"
    ]);
  });

  it("formats text output", () => {
    const text = formatProviderList(listProviders(), "text");

    expect(text).toContain("id\tname\tquota\tnotes");
    expect(text).toContain("blacksmith\tBlacksmith");
  });
});

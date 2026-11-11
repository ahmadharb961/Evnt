import { describe, expect, it } from "vitest";
import { missing } from "../scripts/i18n-missing";
import { ALL } from "@/i18n/tr";

describe("translations", () => {
  it("every interface text has Arabic and French", () => {
    expect(missing).toEqual([]);
  });
  it("placeholders are preserved in every translation", () => {
    const bad = ALL.filter(([en, ar, fr]) => {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
      return ph(en) !== ph(ar) || ph(en) !== ph(fr);
    }).map(([en]) => en);
    expect(bad).toEqual([]);
  });
});

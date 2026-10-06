import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveBrand } from "./branding";
import { BRAND_DEFAULTS } from "./defaults";

afterEach(() => vi.restoreAllMocks());

describe("resolveBrand", () => {
  it("accepts the two known brands, case/space-insensitively", () => {
    expect(resolveBrand("sovereign")).toBe("sovereign");
    expect(resolveBrand("normattiva")).toBe("normattiva");
    expect(resolveBrand("  Normattiva ")).toBe("normattiva");
  });

  it("falls back to sovereign when unset or empty, without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveBrand(undefined)).toBe("sovereign");
    expect(resolveBrand("")).toBe("sovereign");
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to sovereign (with a warning) for an unknown value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveBrand("normatiiva")).toBe("sovereign");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("always yields a brand that BRAND_DEFAULTS can be indexed with", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const raw of ["normattiva", "sovereign", "bogus", undefined, 42, null]) {
      expect(BRAND_DEFAULTS[resolveBrand(raw)]).toBeDefined();
    }
  });
});

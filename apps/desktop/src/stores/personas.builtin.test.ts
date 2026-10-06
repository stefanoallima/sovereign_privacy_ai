import { describe, it, expect } from "vitest";
import { DEFAULT_PERSONAS } from "./personas";

describe("built-in personas invariants", () => {
  it("seeds legal-advisor-it unconditionally (brand filtering happens at the UI layer)", () => {
    // BRAND_DEFAULTS.normattiva.defaultPersonaId references "legal-advisor-it", so a
    // fresh Normattiva install needs it seeded. filterVisiblePersonas hides it on Sovereign.
    expect(DEFAULT_PERSONAS.find((p) => p.id === "legal-advisor-it")).toBeDefined();
  });

  it("every built-in persona has a unique id", () => {
    const ids = DEFAULT_PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every built-in persona has required fields", () => {
    for (const p of DEFAULT_PERSONAS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.icon).toBeTruthy();
      expect(p.systemPrompt).toBeTruthy();
      expect(typeof p.isBuiltIn).toBe("boolean");
    }
  });
});

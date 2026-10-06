import { describe, it, expect } from "vitest";
import {
  filterVisiblePersonas,
  filterVisibleBackends,
} from "./filters";

describe("filterVisiblePersonas", () => {
  const personas = [
    { id: "general-assistant", name: "General" },
    { id: "psychologist", name: "Psychologist" },
    { id: "legal-advisor-it", name: "Legal Advisor Italia" },
    { id: "tax-accountant", name: "Tax Accountant" },
  ];

  it("excludes legal-advisor-it when brand is sovereign", () => {
    const result = filterVisiblePersonas(personas, "sovereign");
    expect(result.map((p) => p.id)).toEqual([
      "general-assistant",
      "psychologist",
      "tax-accountant",
    ]);
    expect(result.find((p) => p.id === "legal-advisor-it")).toBeUndefined();
  });

  it("returns only legal-advisor-it when brand is normattiva", () => {
    const result = filterVisiblePersonas(personas, "normattiva");
    expect(result.map((p) => p.id)).toEqual(["legal-advisor-it"]);
  });

  it("preserves the rest of the persona object", () => {
    const result = filterVisiblePersonas(personas, "normattiva");
    expect(result[0]).toEqual({
      id: "legal-advisor-it",
      name: "Legal Advisor Italia",
    });
  });

  it("returns empty array when no personas match (normattiva, no legal-advisor-it)", () => {
    const result = filterVisiblePersonas(
      [{ id: "psychologist", name: "P" }],
      "normattiva"
    );
    expect(result).toEqual([]);
  });

  it("works with arbitrary record types via { id: string } constraint", () => {
    type Custom = { id: string; label: string };
    const items: Custom[] = [
      { id: "alpha", label: "Alpha" },
      { id: "legal-advisor-it", label: "Legal" },
      { id: "beta", label: "Beta" },
    ];
    const result = filterVisiblePersonas(items, "sovereign");
    expect(result.map((c) => c.id)).toEqual(["alpha", "beta"]);
    expect(result.map((c) => c.label)).toEqual(["Alpha", "Beta"]);
  });
});

describe("filterVisibleBackends", () => {
  const backends = ["nebius", "ollama", "hybrid", "normattiva"] as const;
  type BackendId = (typeof backends)[number];

  it("excludes 'normattiva' when brand is sovereign", () => {
    const result = filterVisibleBackends<BackendId>(
      [...backends],
      "sovereign"
    );
    expect(result).toEqual(["nebius", "ollama", "hybrid"]);
    expect(result).not.toContain("normattiva");
  });

  it("returns only 'normattiva' when brand is normattiva", () => {
    const result = filterVisibleBackends<BackendId>(
      [...backends],
      "normattiva"
    );
    expect(result).toEqual(["normattiva"]);
  });

  it("returns empty array when no backends match (normattiva, no normattiva backend)", () => {
    const result = filterVisibleBackends<"nebius" | "ollama">(
      ["nebius", "ollama"],
      "normattiva"
    );
    expect(result).toEqual([]);
  });

  it("works with plain string arrays", () => {
    const result = filterVisibleBackends(["nebius", "normattiva"], "sovereign");
    expect(result).toEqual(["nebius"]);
  });
});

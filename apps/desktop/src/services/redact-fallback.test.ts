import { describe, it, expect } from "vitest";
import { jsFallbackRedact } from "./redact-fallback";

const terms = [
  { label: "Email", value: "jan.devries@example.com", replacement: "ema_1__________________" },
  { label: "Name", value: "Jan de Vries", replacement: "nam_1_______" },
];

describe("jsFallbackRedact", () => {
  it("replaces known terms case-insensitively and records mappings", () => {
    const r = jsFallbackRedact("Mail JAN.DEVRIES@example.com or ask jan de vries", terms);
    expect(r.text).toBe("Mail ema_1__________________ or ask nam_1_______");
    expect(r.count).toBe(2);
    expect(r.mappings.get("nam_1_______")).toBe("Jan de Vries");
  });

  it("treats regex metacharacters in values literally", () => {
    const r = jsFallbackRedact("a+b a.b", [{ label: "X", value: "a+b", replacement: "x_1" }]);
    expect(r.text).toBe("x_1 a.b");
  });
});

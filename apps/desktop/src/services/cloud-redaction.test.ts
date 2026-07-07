import { describe, it, expect, beforeEach } from "vitest";
import {
  redactForCloud,
  glinerWindows,
  dropOverlappingEntities,
} from "./cloud-redaction";
import { usePiiVaultStore } from "@/stores/piiVault";
import { useUserContextStore } from "@/stores/userContext";

// F3: values saved ONLY in the PII Vault (not in the profile-wide customRedactTerms,
// not caught by GLiNER) must still be redacted by the redactForCloud chokepoint —
// otherwise they leak to the cloud in the direct/summary paths (which use
// redactForCloud, unlike the hybrid path which applies the vault manually).
describe("redactForCloud — PII Vault coverage (F3)", () => {
  beforeEach(() => {
    usePiiVaultStore.getState().clear();
    // Fresh active profile so customRedactTerms starts empty for this test.
    useUserContextStore.getState().createProfile("vault-f3-test");
  });

  it("redacts a vault-only value even when it is NOT in customRedactTerms and GLiNER finds nothing", async () => {
    // GLiNER stub returns [] (test-helpers/setup.ts); the value lives ONLY in the vault.
    usePiiVaultStore.getState().addEntry("Segreto SpA", "organization");

    const { redacted, mappings } = await redactForCloud(
      "Il contratto con Segreto SpA è nullo."
    );

    // The vault value must be tokenized before it could reach the cloud.
    expect(redacted).not.toContain("Segreto SpA");
    expect([...mappings.values()]).toContain("Segreto SpA");
  });

  it("does not alter text when the vault is empty", async () => {
    const { redacted } = await redactForCloud("Nessun dato sensibile qui.");
    expect(redacted).toBe("Nessun dato sensibile qui.");
  });
});

// #5: long documents (larger than the GLiNER context window) must still be scanned
// for NOVEL PII — GLiNER is windowed across the whole text, not skipped.
describe("redactForCloud — long-document GLiNER windowing (#5)", () => {
  beforeEach(() => {
    usePiiVaultStore.getState().clear();
    useUserContextStore.getState().createProfile("gliner-long-doc-test");
  });

  it("redacts GLiNER-detected PII that appears BEYOND the single-window limit", async () => {
    // Sentinel name (see test-helpers/setup.ts) after >6000 chars of filler — i.e.
    // in the SECOND window. The old skip-if-long behaviour missed it entirely.
    const filler = "Testo di riempimento del documento. ".repeat(220); // ~7900 chars
    const text = `${filler} Il testimone chiave era Giulia Bianchi.`;
    expect(text.length).toBeGreaterThan(6000);

    const { redacted, mappings } = await redactForCloud(text);
    expect(redacted).not.toContain("Giulia Bianchi");
    expect([...mappings.values()]).toContain("Giulia Bianchi");
  });

  it("still redacts GLiNER-detected PII in a short document (single window)", async () => {
    const { redacted, mappings } = await redactForCloud(
      "Il testimone era Giulia Bianchi."
    );
    expect(redacted).not.toContain("Giulia Bianchi");
    expect([...mappings.values()]).toContain("Giulia Bianchi");
  });
});

describe("glinerWindows", () => {
  it("returns a single full-text window for short text", () => {
    expect(glinerWindows("short", 6000)).toEqual([{ offset: 0, chunk: "short" }]);
  });

  it("covers the whole text with overlapping windows (no gaps) for long text", () => {
    const text = "abcdefghij".repeat(2000); // 20000 chars
    const w = glinerWindows(text, 6000, 256);
    expect(w.length).toBeGreaterThan(1);
    for (const { chunk } of w) expect(chunk.length).toBeLessThanOrEqual(6000);
    const covers = (i: number) =>
      w.some(({ offset, chunk }) => i >= offset && i < offset + chunk.length);
    expect(covers(0)).toBe(true);
    expect(covers(6000)).toBe(true); // the boundary the old skip-if code missed
    expect(covers(text.length - 1)).toBe(true);
    // Consecutive windows overlap → no character falls in a gap.
    for (let k = 1; k < w.length; k++) {
      expect(w[k].offset).toBeLessThan(w[k - 1].offset + w[k - 1].chunk.length);
    }
  });

  it("caps the number of windows for a pathologically long document (#8)", () => {
    const text = "x".repeat(6000 * 100); // 600k chars
    expect(glinerWindows(text, 6000, 256, 5)).toHaveLength(5);
  });
});

describe("dropOverlappingEntities (#9)", () => {
  const e = (start: number, end: number) => ({ text: "x", label: "L", start, end });

  it("returns a pairwise non-overlapping set", () => {
    const kept = dropOverlappingEntities([e(0, 5), e(3, 12), e(10, 15), e(10, 20)]);
    for (let i = 1; i < kept.length; i++) {
      expect(kept[i].start).toBeGreaterThanOrEqual(kept[i - 1].end);
    }
  });

  it("prefers the longer span on a shared start", () => {
    expect(dropOverlappingEntities([e(0, 5), e(0, 10)])).toEqual([e(0, 10)]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";

const e = createElement;

const mockUpdateSettings = vi.fn();
const mockSettings: { legalDisclaimerAcknowledged: boolean } = {
  legalDisclaimerAcknowledged: false,
};

vi.mock("@/stores", () => ({
  useSettingsStore: vi.fn(() => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
  })),
}));

describe("LegalDisclaimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    mockSettings.legalDisclaimerAcknowledged = false;
  });

  it("returns null for Sovereign build (default VITE_BRAND)", async () => {
    const { LegalDisclaimer } = await import("./LegalDisclaimer");
    const html = renderToString(e(LegalDisclaimer));
    expect(html).toBe("");
  });

  it("returns null for Sovereign build (explicit VITE_BRAND=sovereign)", async () => {
    vi.stubEnv("VITE_BRAND", "sovereign");
    const { LegalDisclaimer } = await import("./LegalDisclaimer");
    const html = renderToString(e(LegalDisclaimer));
    expect(html).toBe("");
  });

  it("renders the disclaimer for Normattiva build when not acknowledged", async () => {
    vi.stubEnv("VITE_BRAND", "normattiva");
    mockSettings.legalDisclaimerAcknowledged = false;
    const { LegalDisclaimer } = await import("./LegalDisclaimer");
    const html = renderToString(e(LegalDisclaimer));
    expect(html).toContain("Avviso Legale");
    expect(html).toContain("ricerca giuridica");
  });

  it("returns null for Normattiva build when already acknowledged", async () => {
    vi.stubEnv("VITE_BRAND", "normattiva");
    mockSettings.legalDisclaimerAcknowledged = true;
    const { LegalDisclaimer } = await import("./LegalDisclaimer");
    const html = renderToString(e(LegalDisclaimer));
    expect(html).toBe("");
  });

  it("exposes a function component", async () => {
    const mod = await import("./LegalDisclaimer");
    expect(typeof mod.LegalDisclaimer).toBe("function");
  });
});

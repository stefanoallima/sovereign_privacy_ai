import { describe, it, expect, beforeEach } from "vitest";
import { usePersonasStore } from "@/stores/personas";

describe("legal-advisor-it persona", () => {
  beforeEach(() => {
    // personas store uses persist; reset to default by reloading.
    // The store doesn't expose a resetToDefaults, so re-derive.
    usePersonasStore.setState({
      personas: usePersonasStore.getState().personas,
      selectedPersonaId: usePersonasStore.getState().selectedPersonaId,
    });
  });

  it("is registered as a built-in persona", () => {
    const p = usePersonasStore.getState().getPersonaById("legal-advisor-it");
    expect(p).toBeDefined();
    expect(p?.isBuiltIn).toBe(true);
  });

  it("uses the normattiva backend with required anonymization", () => {
    const p = usePersonasStore.getState().getPersonaById("legal-advisor-it");
    expect(p?.preferred_backend).toBe("normattiva");
    expect(p?.anonymization_mode).toBe("required");
    expect(p?.enable_local_anonymizer).toBe(true);
    expect(p?.requiresPIIVault).toBe(true);
  });

  it("references the normattiva-legal-pro model", () => {
    const p = usePersonasStore.getState().getPersonaById("legal-advisor-it");
    expect(p?.preferredModelId).toBe("normattiva-legal-pro");
  });
});

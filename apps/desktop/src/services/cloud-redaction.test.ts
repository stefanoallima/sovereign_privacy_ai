import { describe, it, expect, beforeEach } from "vitest";
import { redactForCloud } from "./cloud-redaction";
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

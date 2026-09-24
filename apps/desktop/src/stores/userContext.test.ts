import { describe, it, expect, beforeEach } from "vitest";
import { useUserContextStore, selectActiveProfile } from "./userContext";

const terms = () =>
  selectActiveProfile(useUserContextStore.getState())?.customRedactTerms ?? [];

describe("redaction terms without a profile", () => {
  beforeEach(() => {
    useUserContextStore.setState({ profiles: [], activeProfileId: null });
  });

  it("ensureRedactTerm creates a default profile and stores the term", () => {
    const token = useUserContextStore
      .getState()
      .ensureRedactTerm("Email", "jan.devries@example.com");
    expect(terms()).toHaveLength(1);
    expect(terms()[0].replacement).toBe(token);
    // Same value → same stable token, still one term.
    expect(
      useUserContextStore.getState().ensureRedactTerm("Email", "JAN.DEVRIES@example.com")
    ).toBe(token);
    expect(terms()).toHaveLength(1);
  });

  it("addCustomRedactTerm is not dropped when no profile exists", () => {
    useUserContextStore.getState().addCustomRedactTerm("Name", "Jan de Vries");
    expect(terms().map((t) => t.value)).toEqual(["Jan de Vries"]);
  });

  it("reuses an existing profile instead of creating another", () => {
    const id = useUserContextStore.getState().createProfile("Work");
    useUserContextStore.setState({ activeProfileId: null });
    useUserContextStore.getState().addCustomRedactTerm("Name", "Jan de Vries");
    const s = useUserContextStore.getState();
    expect(s.profiles).toHaveLength(1);
    expect(s.activeProfileId).toBe(id);
  });
});

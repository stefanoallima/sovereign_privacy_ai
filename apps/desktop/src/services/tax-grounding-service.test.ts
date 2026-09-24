import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTaxGroundingContext } from "./tax-grounding-service";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}));

const persona = { name: "Tax Navigator", systemPrompt: "Dutch tax" };
const message = "Mijn BSN is 123456789, kan ik hypotheekrenteaftrek krijgen?";
const concept = {
  term: "Hypotheekrenteaftrek",
  definition: "Mortgage interest deduction",
  why_needed: "Box 1 deduction",
  related_boxes: ["Box 1"],
  evidence_required: [],
  applicable_year: 2025,
  box_number: "Box 1",
};
const block = "## Tax Concepts Available\n\n- **Hypotheekrenteaftrek** ...\n\nGround your reply in these concepts.";

describe("getTaxGroundingContext", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("returns only the concept block, never the user message", async () => {
    invokeMock.mockResolvedValue({
      augmented_message: `${block}\n\n---\n\n${message}`,
      consulted_concept_ids: ["hypotheekrenteaftrek"],
      concepts_used: [concept],
      injected: true,
    });
    const r = await getTaxGroundingContext(message, persona);
    expect(r?.context).toBe(block);
    expect(r?.context).not.toContain("123456789");
    expect(r?.consultedConceptIds).toEqual(["hypotheekrenteaftrek"]);
    expect(r?.consultedConcepts).toEqual([concept]);
  });

  it("returns null when nothing was injected", async () => {
    invokeMock.mockResolvedValue({
      augmented_message: message,
      consulted_concept_ids: [],
      concepts_used: [],
      injected: false,
    });
    expect(await getTaxGroundingContext(message, persona)).toBeNull();
  });

  it("returns null if the backend format no longer ends with the message", async () => {
    invokeMock.mockResolvedValue({
      augmented_message: `${message}\n\n${block}`,
      consulted_concept_ids: ["x"],
      concepts_used: [],
      injected: true,
    });
    expect(await getTaxGroundingContext(message, persona)).toBeNull();
  });

  it("returns null when the command fails", async () => {
    invokeMock.mockImplementation(async () => {
      throw new Error("no tauri");
    });
    expect(await getTaxGroundingContext(message, persona)).toBeNull();
  });
});

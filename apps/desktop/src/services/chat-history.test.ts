import { describe, it, expect } from "vitest";
import { withoutCurrentMessage } from "./chat-history";

const u = (content: string) => ({ role: "user", content });
const a = (content: string) => ({ role: "assistant", content });

describe("withoutCurrentMessage", () => {
  it("drops the just-stored current message", () => {
    const history = [u("hi"), a("hello"), u("My name is Jan")];
    expect(withoutCurrentMessage(history, "  My name is Jan ")).toEqual([u("hi"), a("hello")]);
  });

  it("drops it in a multi-persona send after earlier persona replies", () => {
    const history = [u("hi"), a("hello"), u("question"), a("persona 1 answer")];
    expect(withoutCurrentMessage(history, "question")).toEqual([
      u("hi"),
      a("hello"),
      a("persona 1 answer"),
    ]);
  });

  it("keeps history untouched when the latest user message differs", () => {
    const history = [u("older"), a("reply")];
    expect(withoutCurrentMessage(history, "new")).toEqual(history);
  });

  it("handles empty history", () => {
    expect(withoutCurrentMessage([], "x")).toEqual([]);
  });
});

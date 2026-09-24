/**
 * The user message is stored in the conversation before it is sent, so the
 * current message is the latest user entry in history (followed only by
 * replies from earlier personas in a multi-persona send). Drop it: every send
 * path appends its own (redacted, possibly user-edited) version, and keeping
 * the stored raw copy would duplicate it and bypass edits made in the review
 * panel.
 */
export function withoutCurrentMessage<T extends { role: string; content: string }>(
  history: T[],
  content: string
): T[] {
  let i = history.length - 1;
  while (i >= 0 && history[i].role === "assistant") i--;
  return i >= 0 && history[i].role === "user" && history[i].content === content.trim()
    ? [...history.slice(0, i), ...history.slice(i + 1)]
    : history;
}

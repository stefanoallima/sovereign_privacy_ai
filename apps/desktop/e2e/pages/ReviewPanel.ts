/**
 * ReviewPanel — Page Object Model for the Prompt Review panel
 * (src/components/chat/PromptReviewPanel.tsx).
 *
 * The panel appears between the chat input and the messages when a cloud-bound
 * message must be reviewed (PII detected, or "Always review before send" is on).
 * It shows the redacted prompt the cloud will receive, an optional collapsible
 * "original message" section, PII redaction counts, attribute badges, and the
 * Approve / Cancel actions.
 *
 * All selectors use data-testid attributes added to PromptReviewPanel.tsx:
 *   prompt-review              — root container
 *   review-processed-prompt    — editable textarea (the cloud-bound prompt)
 *   review-original-toggle     — button that expands the original message
 *   review-original-text       — original message body (only when expanded)
 *   pii-redaction-count        — "[N] redactions" badge (data-redaction-count=N)
 *   review-attribute-badges    — container holding the info badges
 *   review-approve / review-cancel — action buttons
 */

import type { Locator, Page } from "@playwright/test";

const TIMEOUT = 10_000;

export class ReviewPanel {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId("prompt-review");
  }

  /**
   * Waits for the panel to be visible. Called by ChatPage.waitForReviewPanel(),
   * but safe to call directly too.
   *
   * @throws if the panel does not appear within the timeout.
   */
  async waitForVisible(): Promise<void> {
    try {
      await this.root.waitFor({ state: "visible", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[ReviewPanel] Prompt review panel ([data-testid="prompt-review"]) ` +
          `did not become visible within ${TIMEOUT}ms. ` +
          `Was a cloud-bound message sent (PII detected or always-review enabled)?`
      );
    }
  }

  /**
   * Reads the redacted prompt text that the cloud will receive.
   *
   * @returns the current value of the editable prompt textarea.
   * @throws if the textarea cannot be found within the timeout.
   */
  async getProcessedPrompt(): Promise<string> {
    const textarea = this.root.getByTestId("review-processed-prompt");
    try {
      await textarea.waitFor({ state: "visible", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[ReviewPanel] Processed-prompt textarea ` +
          `([data-testid="review-processed-prompt"]) not found within ${TIMEOUT}ms.`
      );
    }
    return textarea.inputValue();
  }

  /**
   * Expands the collapsible "Your original message" section (if not already
   * open) and returns its raw text — which still contains the un-redacted PII.
   *
   * @returns the original (pre-redaction) message text.
   * @throws if the toggle or body cannot be found within the timeout.
   */
  async getOriginalMessage(): Promise<string> {
    const body = this.root.getByTestId("review-original-text");
    if (!(await body.isVisible())) {
      const toggle = this.root.getByTestId("review-original-toggle");
      try {
        await toggle.click({ timeout: TIMEOUT });
      } catch {
        throw new Error(
          `[ReviewPanel] Original-message toggle ` +
            `([data-testid="review-original-toggle"]) not clickable within ${TIMEOUT}ms.`
        );
      }
    }
    try {
      await body.waitFor({ state: "visible", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[ReviewPanel] Original-message body ` +
          `([data-testid="review-original-text"]) did not appear within ${TIMEOUT}ms.`
      );
    }
    return (await body.innerText()).trim();
  }

  /**
   * Reads the "[N] redactions" PII badge and extracts the number.
   *
   * @returns the redaction count, or 0 when no PII badge is present (the badge
   *          is only rendered when totalRedactions > 0).
   */
  async getPiiRedactionCount(): Promise<number> {
    const badge = this.root.getByTestId("pii-redaction-count");
    // The badge is conditionally rendered; absence means zero redactions.
    if ((await badge.count()) === 0) return 0;
    // Prefer the machine-readable data attribute; fall back to parsing text.
    const attr = await badge.getAttribute("data-redaction-count");
    if (attr !== null && attr.trim() !== "") {
      const n = Number.parseInt(attr, 10);
      if (!Number.isNaN(n)) return n;
    }
    const text = (await badge.innerText()).trim();
    const match = text.match(/\d+/);
    if (!match) {
      throw new Error(
        `[ReviewPanel] Could not parse a redaction count from badge text: "${text}".`
      );
    }
    return Number.parseInt(match[0], 10);
  }

  /**
   * Reads the attribute / privacy info badges shown in the panel, e.g.
   * "3 attributes extracted", "No PII in prompt", "45% reduced".
   *
   * @returns a list of badge label strings (empty if no badges are shown).
   */
  async getAttributeBadges(): Promise<string[]> {
    const container = this.root.getByTestId("review-attribute-badges");
    if ((await container.count()) === 0) return [];
    const badges = container.locator(
      '[data-testid="review-badge-attributes"], ' +
        '[data-testid="review-badge-no-pii"], ' +
        '[data-testid="review-badge-reduced"]'
    );
    const count = await badges.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      labels.push((await badges.nth(i).innerText()).trim());
    }
    return labels;
  }

  /**
   * Optionally overwrites the redacted prompt, then clicks "Approve & Send".
   * Waits for the panel to disappear so the caller knows the send has started.
   *
   * @param editOverride if provided, replaces the textarea contents before approving.
   * @throws if the approve button is not clickable within the timeout.
   */
  async approve(editOverride?: string): Promise<void> {
    if (editOverride !== undefined) {
      const textarea = this.root.getByTestId("review-processed-prompt");
      try {
        await textarea.fill(editOverride, { timeout: TIMEOUT });
      } catch {
        throw new Error(
          `[ReviewPanel] Could not edit the processed prompt ` +
            `([data-testid="review-processed-prompt"]) within ${TIMEOUT}ms.`
        );
      }
    }
    const approveBtn = this.root.getByTestId("review-approve");
    try {
      await approveBtn.click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[ReviewPanel] Approve button ([data-testid="review-approve"]) ` +
          `not clickable within ${TIMEOUT}ms.`
      );
    }
    // Panel closes once the message is approved; wait so callers can continue.
    await this.root
      .waitFor({ state: "hidden", timeout: TIMEOUT })
      .catch(() => {
        /* Panel may remain if approval is blocked; leave for caller to assert. */
      });
  }

  /**
   * Clicks "Cancel", dismissing the review and returning the message to the
   * input field. Waits for the panel to disappear.
   *
   * @throws if the cancel button is not clickable within the timeout.
   */
  async cancel(): Promise<void> {
    const cancelBtn = this.root.getByTestId("review-cancel");
    try {
      await cancelBtn.click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[ReviewPanel] Cancel button ([data-testid="review-cancel"]) ` +
          `not clickable within ${TIMEOUT}ms.`
      );
    }
    await this.root
      .waitFor({ state: "hidden", timeout: TIMEOUT })
      .catch(() => {
        /* Tolerate slow close; caller can assert input state. */
      });
  }
}

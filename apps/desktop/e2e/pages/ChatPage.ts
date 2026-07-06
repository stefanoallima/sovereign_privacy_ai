/**
 * ChatPage — Page Object Model for the main chat surface
 * (src/components/chat/ChatWindow.tsx + Sidebar.tsx + MessageBubble.tsx).
 *
 * Encapsulates sending messages, waiting for the privacy review panel,
 * reading assistant replies, toggling incognito mode, and selecting a persona.
 *
 * data-testid selectors used (added to the components):
 *   chat-input          — message <textarea>          (ChatWindow.tsx)
 *   chat-send           — send <button> (aria-label="Send")
 *   message-assistant   — assistant message wrapper    (MessageBubble.tsx)
 *   message-content     — assistant message body text
 *   incognito-toggle    — "New incognito chat" button  (Sidebar.tsx)
 *   incognito-banner    — incognito indicator in chat header (ChatWindow.tsx)
 *   new-chat            — "New chat" button             (Sidebar.tsx)
 *
 * Notes on app behaviour:
 *   - Personas are not chosen from a dropdown; they are addressed inline with
 *     an @mention in the message input. selectPersona() types "@<name> " so the
 *     next sendMessage() routes to that persona, matching the real UI flow.
 *   - Incognito is a per-conversation flag set when a conversation is created
 *     via the sidebar's incognito button (there is no in-chat on/off switch).
 *     toggleIncognito() starts a fresh incognito conversation and reports the
 *     resulting state from the incognito banner.
 */

import type { Locator, Page } from "@playwright/test";
import { ReviewPanel } from "./ReviewPanel";

const TIMEOUT = 10_000;

export class ChatPage {
  readonly page: Page;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly incognitoButton: Locator;
  readonly incognitoBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.input = page.getByTestId("chat-input");
    this.sendButton = page.getByTestId("chat-send");
    this.incognitoButton = page.getByTestId("incognito-toggle");
    this.incognitoBanner = page.getByTestId("incognito-banner");
  }

  /**
   * Types a message into the chat input and submits it.
   *
   * Submission uses the Send button when it is enabled; if the button is not
   * interactable it falls back to pressing Enter (Shift+Enter is newline; a bare
   * Enter sends in ChatWindow.handleKeyDown). Does NOT wait for a reply or the
   * review panel — use waitForReviewPanel() / getLastAssistantMessage() next.
   *
   * @param text the message to send.
   * @throws if the input cannot be focused/filled within the timeout.
   */
  async sendMessage(text: string): Promise<void> {
    try {
      await this.input.waitFor({ state: "visible", timeout: TIMEOUT });
      await this.input.fill(text);
    } catch {
      throw new Error(
        `[ChatPage] Chat input ([data-testid="chat-input"]) not available ` +
          `within ${TIMEOUT}ms. Is a conversation open?`
      );
    }

    // Prefer the explicit Send button when it is enabled.
    const sendEnabled = await this.sendButton
      .isEnabled()
      .catch(() => false);
    if (sendEnabled) {
      await this.sendButton.click({ timeout: TIMEOUT });
    } else {
      // Fallback: Enter submits (no shift) per ChatWindow keydown handling.
      await this.input.press("Enter");
    }
  }

  /**
   * Waits for the Prompt Review panel to appear and returns a ReviewPanel POM.
   *
   * @returns a ReviewPanel bound to the same page.
   * @throws if the panel does not appear within the timeout.
   */
  async waitForReviewPanel(): Promise<ReviewPanel> {
    const panel = new ReviewPanel(this.page);
    await panel.waitForVisible();
    return panel;
  }

  /**
   * Returns the text of the most recent assistant message in the chat history.
   *
   * @returns the trimmed body text of the last assistant bubble.
   * @throws if no assistant message is present within the timeout.
   */
  async getLastAssistantMessage(): Promise<string> {
    const assistantMessages = this.page.getByTestId("message-assistant");
    try {
      await assistantMessages
        .first()
        .waitFor({ state: "attached", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[ChatPage] No assistant message ([data-testid="message-assistant"]) ` +
          `appeared within ${TIMEOUT}ms.`
      );
    }
    const last = assistantMessages.last();
    // Prefer the inner content node (excludes persona name / badges); fall back
    // to the whole bubble if the content node is absent (e.g. canvas-routed).
    const content = last.getByTestId("message-content");
    if ((await content.count()) > 0) {
      return (await content.innerText()).trim();
    }
    return (await last.innerText()).trim();
  }

  /**
   * Starts a fresh incognito conversation via the sidebar's incognito button
   * and reports the resulting incognito state.
   *
   * The app has no in-place on/off incognito switch — incognito is a property
   * set at conversation creation — so this returns true when the new
   * conversation's incognito banner is shown.
   *
   * @returns the new incognito state (true once the incognito chat is active).
   * @throws if the incognito button cannot be clicked within the timeout.
   */
  async toggleIncognito(): Promise<boolean> {
    try {
      await this.incognitoButton.click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[ChatPage] Incognito button ([data-testid="incognito-toggle"]) ` +
          `not clickable within ${TIMEOUT}ms.`
      );
    }
    // The incognito banner confirms the active conversation is incognito.
    const isIncognito = await this.incognitoBanner
      .waitFor({ state: "visible", timeout: TIMEOUT })
      .then(() => true)
      .catch(() => false);
    return isIncognito;
  }

  /**
   * Targets a persona for the next message by inserting an @mention into the
   * input (the app's real persona-routing mechanism — there is no dropdown).
   * The mention menu is dismissed before returning so the literal text remains.
   *
   * @param name the persona's display name (matched case-insensitively by the app).
   * @throws if the input cannot be focused within the timeout.
   */
  async selectPersona(name: string): Promise<void> {
    try {
      await this.input.waitFor({ state: "visible", timeout: TIMEOUT });
      await this.input.click();
    } catch {
      throw new Error(
        `[ChatPage] Chat input ([data-testid="chat-input"]) not available ` +
          `within ${TIMEOUT}ms while selecting persona "${name}".`
      );
    }
    // Typing "@" opens the mention menu; type the name then a space to commit
    // the mention and close the menu (matches ChatWindow mention handling).
    await this.input.pressSequentially(`@${name} `, { delay: 10 });
    // Ensure the mention popup is closed so subsequent text is plain input.
    await this.page.keyboard.press("Escape");
  }
}

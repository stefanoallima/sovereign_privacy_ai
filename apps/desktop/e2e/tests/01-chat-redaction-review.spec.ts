/**
 * 01-chat-redaction-review.spec.ts
 *
 * Workflow: Chat → Redaction → Review → Approval
 *
 * Covers: PII detection (vault-term matching + GLiNER), redaction shown in the
 * Prompt Review Panel, cloud-payload privacy, user edits, and keyboard shortcuts.
 *
 * Design reference: design.md § 3.1
 * Requirements reference: specs.md § W1
 */

import { expect } from "@playwright/test";
import { test } from "../fixtures/app";
import { ChatPage } from "../pages/ChatPage";
import { ReviewPanel } from "../pages/ReviewPanel";
import {
  stubCloudApi,
  captureCloudPayload,
} from "../helpers/network";
import {
  verifyRedaction,
  verifyPlaceholder,
  verifyNoPII,
} from "../helpers/privacy";
import { seedVault, seedSettings, clearVault } from "../helpers/store";

// ---------------------------------------------------------------------------
// Test data — synthetic Dutch-locale PII, structurally realistic, not real.
// ---------------------------------------------------------------------------

const PERSON_NAME = "Jan de Vries";
const INCOME_AMOUNT = "EUR 5000";
const EMAIL_NOVEL = "novel.user@testdomain.example";
const EMAIL_VAULT = "jan.devries@example.com";

/** Canned SSE response that the cloud API stub returns for any chat request. */
const STUB_RESPONSE = {
  choices: [
    {
      delta: { content: "Understood, I will help you with that." },
      finish_reason: "stop",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers — navigate to the app's dev URL before each test (the fixture
// already cleared localStorage and IndexedDB in beforeEach).
// ---------------------------------------------------------------------------

const APP_URL = "http://localhost:5173";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("chat-redaction-review", () => {
  /**
   * T1: [hybrid] name PII appears as placeholder in review panel, not in cloud payload.
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault: "Jan de Vries" / "person name"
   *  3. Stub cloud API
   *  4. Send message containing the name
   *  5. Wait for review panel — assert placeholder present, raw name absent
   *  6. Approve and assert cloud payload contains no raw name
   */
  test(
    "[hybrid] name PII appears as placeholder in review panel, not in cloud payload",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [{ text: PERSON_NAME, category: "person name" }]);

      const chatPage = new ChatPage(page);
      // Stub must be registered before captureCloudPayload so the capture route
      // (LIFO: registered first = runs last) can call route.continue() and the
      // stub route (registered second = runs first) fulfills it.
      await stubCloudApi(page, STUB_RESPONSE);

      const cloudPayload = await captureCloudPayload(page, async () => {
        await chatPage.sendMessage(`My client ${PERSON_NAME} needs tax advice.`);

        const reviewPanel = await chatPage.waitForReviewPanel();
        const processedPrompt = await reviewPanel.getProcessedPrompt();

        // Panel must show a vault placeholder, not the raw name.
        await verifyRedaction(processedPrompt, PERSON_NAME);
        await verifyPlaceholder(processedPrompt, /\[VAULT_PERSON_NAME_\d+\]/);

        // Redaction count must be at least 1.
        const count = await reviewPanel.getPiiRedactionCount();
        expect(count).toBeGreaterThanOrEqual(1);

        await reviewPanel.approve();
      });

      await verifyNoPII(cloudPayload, [PERSON_NAME]);
    }
  );

  /**
   * T2: [hybrid] financial amount substituted with vault placeholder.
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault: "EUR 5000" / "income amount"
   *  3. Stub cloud API and capture payload
   *  4. Send message containing exact amount
   *  5. Assert review shows [VAULT_INCOME_AMOUNT_*]
   *  6. Approve and verify amount not in cloud request
   */
  test(
    "[hybrid] financial amount substituted with vault placeholder",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [{ text: INCOME_AMOUNT, category: "income amount" }]);

      const chatPage = new ChatPage(page);
      await stubCloudApi(page, STUB_RESPONSE);

      const cloudPayload = await captureCloudPayload(page, async () => {
        await chatPage.sendMessage(
          `My monthly income is ${INCOME_AMOUNT}. What can I deduct?`
        );

        const reviewPanel = await chatPage.waitForReviewPanel();
        const processedPrompt = await reviewPanel.getProcessedPrompt();

        await verifyRedaction(processedPrompt, INCOME_AMOUNT);
        await verifyPlaceholder(processedPrompt, /\[VAULT_INCOME_AMOUNT_\d+\]/);

        const count = await reviewPanel.getPiiRedactionCount();
        expect(count).toBeGreaterThanOrEqual(1);

        await reviewPanel.approve();
      });

      await verifyNoPII(cloudPayload, [INCOME_AMOUNT]);
    }
  );

  /**
   * T3: [cloud] GLiNER off: term-matching redaction on known vault entries.
   *
   * When GLiNER is disabled the app falls back to lexical vault-term matching.
   * A seeded email should still be substituted with its vault placeholder.
   *
   * Steps:
   *  1. Seed settings: privacyMode=cloud, glinerEnabled=false
   *  2. Seed vault: known email address / "email address"
   *  3. Stub cloud API and capture payload
   *  4. Send message containing the exact seeded email
   *  5. Assert email redacted (placeholder present) in review panel
   *  6. Approve and verify no raw email in cloud payload
   */
  test(
    "[cloud] GLiNER off: term-matching redaction on known vault entries",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, {
        privacyMode: "cloud",
        glinerEnabled: false,
      });
      await seedVault(page, [
        { text: EMAIL_VAULT, category: "email address" },
      ]);

      const chatPage = new ChatPage(page);
      await stubCloudApi(page, STUB_RESPONSE);

      const cloudPayload = await captureCloudPayload(page, async () => {
        await chatPage.sendMessage(
          `Please reach out to ${EMAIL_VAULT} for the contract.`
        );

        const reviewPanel = await chatPage.waitForReviewPanel();
        const processedPrompt = await reviewPanel.getProcessedPrompt();

        // Vault-term matching must substitute the seeded email.
        await verifyRedaction(processedPrompt, EMAIL_VAULT);
        await verifyPlaceholder(processedPrompt, /\[VAULT_EMAIL_ADDRESS_\d+\]/);

        await reviewPanel.approve();
      });

      await verifyNoPII(cloudPayload, [EMAIL_VAULT]);
    }
  );

  /**
   * T4: [cloud] GLiNER on: novel PII detected, confirmation panel shown, entry added to vault.
   *
   * A novel email (not in vault) sent with GLiNER enabled should surface the
   * PiiConfirmationPanel. After the user confirms, the email must appear in the
   * vault store.
   *
   * Steps:
   *  1. Seed settings: privacyMode=cloud, glinerEnabled=true
   *  2. Vault is empty (no pre-seeded entries)
   *  3. Send message with novel email
   *  4. Wait for PiiConfirmationPanel ([data-testid="pii-confirmation-panel"])
   *  5. Confirm the detected entity
   *  6. Assert vault now contains the email entry
   */
  test(
    "[cloud] GLiNER on: novel email detected, confirmation panel shown, entry added to vault",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, {
        privacyMode: "cloud",
        glinerEnabled: true,
      });
      await clearVault(page);

      const chatPage = new ChatPage(page);
      // No cloud send happens until the user confirms PII and approves;
      // stub the API so a subsequent approve does not hit the real endpoint.
      await stubCloudApi(page, STUB_RESPONSE);

      await chatPage.sendMessage(
        `Contact me at ${EMAIL_NOVEL} to schedule the meeting.`
      );

      // The PiiConfirmationPanel should appear for the novel email detected by GLiNER.
      const confirmationPanel = page.getByTestId("pii-confirmation-panel");
      await confirmationPanel.waitFor({ state: "visible", timeout: 15_000 });

      // Confirm the suggested vault entry (the primary confirm button).
      const confirmBtn = confirmationPanel.getByTestId("pii-confirm-add");
      await confirmBtn.click({ timeout: 10_000 });

      // After confirmation the entry must be persisted in the vault store.
      // The vault store writes to localStorage; read it back.
      const vaultRaw = await page.evaluate(() =>
        localStorage.getItem("pii-vault")
      );
      expect(vaultRaw).not.toBeNull();
      const vaultState = JSON.parse(vaultRaw!) as {
        state: { entries: { text: string }[] };
      };
      const texts = vaultState.state.entries.map((e) =>
        e.text.toLowerCase()
      );
      expect(texts).toContain(EMAIL_NOVEL.toLowerCase());
    }
  );

  /**
   * T5: [hybrid] user edits redacted prompt before approval — edited version sent.
   *
   * The Review Panel exposes an editable textarea. When the user rewrites the
   * processed prompt before clicking Approve, the cloud must receive the edited
   * text, not the original or the default redacted version.
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault: person name
   *  3. Stub + capture cloud payload
   *  4. Send message with PII
   *  5. Review panel shown — edit the processed prompt
   *  6. Click Approve
   *  7. Assert cloud payload contains edited text and no raw PII
   */
  test(
    "[hybrid] user edits redacted prompt before approval — edited version sent to cloud",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [{ text: PERSON_NAME, category: "person name" }]);

      const chatPage = new ChatPage(page);
      const EDITED_PROMPT =
        "My client [PERSON] needs help filing their annual tax return.";

      await stubCloudApi(page, STUB_RESPONSE);

      const cloudPayload = await captureCloudPayload(page, async () => {
        await chatPage.sendMessage(
          `My client ${PERSON_NAME} needs help filing their annual tax return.`
        );

        const reviewPanel = await chatPage.waitForReviewPanel();

        // Edit the processed prompt before approving.
        await reviewPanel.approve(EDITED_PROMPT);
      });

      // Cloud must have received the edited prompt, not the raw name.
      const serialised = JSON.stringify(cloudPayload).toLowerCase();
      expect(serialised).toContain("[person]");
      await verifyNoPII(cloudPayload, [PERSON_NAME]);
    }
  );

  /**
   * T6: [hybrid] Ctrl+Enter keyboard shortcut approves and sends.
   *
   * When the Review Panel is visible, pressing Ctrl+Enter should approve the
   * message without the user clicking the Approve button, and the panel should
   * disappear.
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault: person name
   *  3. Stub cloud API
   *  4. Send message with PII
   *  5. Review panel visible — press Ctrl+Enter
   *  6. Assert review panel closes (message sent)
   */
  test(
    "[hybrid] Ctrl+Enter keyboard shortcut approves and sends",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [{ text: PERSON_NAME, category: "person name" }]);

      await stubCloudApi(page, STUB_RESPONSE);

      const chatPage = new ChatPage(page);
      await chatPage.sendMessage(
        `Please advise ${PERSON_NAME} on their pension planning.`
      );

      const reviewPanel = new ReviewPanel(page);
      await reviewPanel.waitForVisible();

      // Press Ctrl+Enter to approve via keyboard shortcut.
      await page.keyboard.press("Control+Enter");

      // The panel must close, confirming the message was sent.
      await expect(reviewPanel.root).toBeHidden({ timeout: 10_000 });
    }
  );

  /**
   * T7: [hybrid] Esc keyboard shortcut cancels review and returns to input.
   *
   * Pressing Escape while the Review Panel is open should dismiss it and restore
   * the original message text to the chat input field.
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault: person name
   *  3. Stub cloud API (no capture — no cloud send expected)
   *  4. Send message with PII
   *  5. Review panel visible — press Esc
   *  6. Assert review panel closes
   *  7. Assert chat input is visible (returned to input state)
   */
  test(
    "[hybrid] Esc keyboard shortcut cancels review and returns to input",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [{ text: PERSON_NAME, category: "person name" }]);

      // Stub the cloud API in case anything slips through after cancel.
      await stubCloudApi(page, STUB_RESPONSE);

      const chatPage = new ChatPage(page);
      const MESSAGE = `Advise ${PERSON_NAME} on mortgage options.`;
      await chatPage.sendMessage(MESSAGE);

      const reviewPanel = new ReviewPanel(page);
      await reviewPanel.waitForVisible();

      // Press Escape to cancel the review.
      await page.keyboard.press("Escape");

      // The review panel must close.
      await expect(reviewPanel.root).toBeHidden({ timeout: 10_000 });

      // The chat input must be visible again (user can type a new message).
      await expect(chatPage.input).toBeVisible({ timeout: 10_000 });
    }
  );
});

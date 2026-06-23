/**
 * 05-prompt-transparency.spec.ts
 *
 * Workflow: Prompt Transparency — Attribute Visibility, Reduction Badges, PII Safety
 *
 * Covers: attribute badge display in the Review Panel, "No PII in prompt" badge
 * when only categorical attributes are sent to the cloud, word-count-based
 * reduction percentage badge, collapsible original message showing raw PII while
 * the processed prompt does NOT, and [ATTR_*] placeholder token pattern matching.
 *
 * Design reference: design.md § 3.5
 */

import { expect } from "@playwright/test";
import { test } from "../fixtures/app";
import { ChatPage } from "../pages/ChatPage";
import {
  stubCloudApi,
  captureCloudPayload,
} from "../helpers/network";
import {
  verifyRedaction,
  verifyPlaceholder,
  verifyNoPII,
} from "../helpers/privacy";
import { seedVault, seedSettings } from "../helpers/store";

// ---------------------------------------------------------------------------
// Test data — synthetic Dutch-locale PII, structurally realistic, not real.
// ---------------------------------------------------------------------------

const PERSON_NAME = "Jan de Vries";
const INCOME_AMOUNT = "EUR 5000";
const EMAIL_ADDRESS = "jan.devries@example.com";

/** Canned SSE response returned by the cloud API stub for any chat request. */
const STUB_RESPONSE = {
  choices: [
    {
      delta: { content: "Understood, I will help you with that." },
      finish_reason: "stop",
    },
  ],
};

const APP_URL = "http://localhost:5173";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("prompt-transparency", () => {
  /**
   * T1: Attribute badges visible in review panel (e.g., "3 attributes extracted").
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault: name, income amount, email address (3 PII entries)
   *  3. Send message containing all three PII values
   *  4. Wait for review panel
   *  5. Assert getAttributeBadges() returns at least one badge string
   *  6. Assert at least one badge label contains a digit (the attribute count)
   */
  test(
    "attribute badges visible in review panel (e.g., '3 attributes extracted')",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [
        { text: PERSON_NAME, category: "person name" },
        { text: INCOME_AMOUNT, category: "income amount" },
        { text: EMAIL_ADDRESS, category: "email address" },
      ]);

      const chatPage = new ChatPage(page);
      await stubCloudApi(page, STUB_RESPONSE);

      await chatPage.sendMessage(
        `My client ${PERSON_NAME} earns ${INCOME_AMOUNT} per month. ` +
          `Contact at ${EMAIL_ADDRESS} for details.`
      );

      const reviewPanel = await chatPage.waitForReviewPanel();
      const badges = await reviewPanel.getAttributeBadges();

      // At least one badge must be rendered when PII is detected.
      expect(badges.length).toBeGreaterThanOrEqual(1);

      // At least one badge label must contain a numeric digit, indicating an
      // attribute count (e.g. "3 attributes", "3 attributes extracted").
      const hasCountBadge = badges.some((label) => /\d/.test(label));
      expect(hasCountBadge).toBe(true);

      await reviewPanel.approve();
    }
  );

  /**
   * T2: "No PII in prompt" badge shown when only categorical attributes reach the cloud.
   *
   * When the processed prompt contains only [ATTR_*] or [VAULT_*] placeholders
   * (no raw PII remains), the review panel must surface a "No PII in prompt"
   * badge and the cloud payload must not contain any raw PII values.
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid, autoRedactAllContent=true
   *  2. Seed vault with name and amount entries
   *  3. Stub + capture cloud payload
   *  4. Send message
   *  5. Assert "no-pii" badge is present in attribute badges container
   *  6. Approve and verify no raw PII in cloud payload
   */
  test(
    '"No PII in prompt" badge shown when all PII is replaced by placeholders',
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, {
        privacyMode: "hybrid",
        autoRedactAllContent: true,
      });
      await seedVault(page, [
        { text: PERSON_NAME, category: "person name" },
        { text: INCOME_AMOUNT, category: "income amount" },
      ]);

      const chatPage = new ChatPage(page);
      await stubCloudApi(page, STUB_RESPONSE);

      const cloudPayload = await captureCloudPayload(page, async () => {
        await chatPage.sendMessage(
          `${PERSON_NAME} wants advice on investing ${INCOME_AMOUNT}.`
        );

        const reviewPanel = await chatPage.waitForReviewPanel();

        // The "no-pii" badge is rendered inside the review-attribute-badges container.
        // We check its presence via the test-id selector used in ReviewPanel.ts.
        const noPiiBadge = reviewPanel.root
          .getByTestId("review-attribute-badges")
          .locator('[data-testid="review-badge-no-pii"]');

        // The badge should appear once all PII has been replaced by placeholders.
        await expect(noPiiBadge).toBeVisible({ timeout: 10_000 });

        // Processed prompt must not contain raw PII.
        const processedPrompt = await reviewPanel.getProcessedPrompt();
        await verifyRedaction(processedPrompt, PERSON_NAME);
        await verifyRedaction(processedPrompt, INCOME_AMOUNT);

        await reviewPanel.approve();
      });

      // Cloud must receive no raw PII values.
      await verifyNoPII(cloudPayload, [PERSON_NAME, INCOME_AMOUNT]);
    }
  );

  /**
   * T3: "X% reduced" badge is correct relative to original word count.
   *
   * The review panel computes a word-count-based reduction percentage by
   * comparing the processed prompt length to the original.  This test verifies
   * that the badge is rendered and contains a percentage value (digits + "%").
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault with multiple PII entries to ensure visible word reduction
   *  3. Send a message mixing normal text with PII values
   *  4. Wait for review panel
   *  5. Assert getAttributeBadges() contains a badge matching /\d+%/ (e.g. "45% reduced")
   */
  test(
    '"X% reduced" badge is present and contains a percentage value',
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [
        { text: PERSON_NAME, category: "person name" },
        { text: INCOME_AMOUNT, category: "income amount" },
        { text: EMAIL_ADDRESS, category: "email address" },
      ]);

      const chatPage = new ChatPage(page);
      await stubCloudApi(page, STUB_RESPONSE);

      // Construct a message where PII values are a meaningful fraction of total words.
      const message =
        `Please help me file taxes. My name is ${PERSON_NAME}, ` +
        `my monthly salary is ${INCOME_AMOUNT}, and you can reach me at ${EMAIL_ADDRESS}.`;

      await chatPage.sendMessage(message);

      const reviewPanel = await chatPage.waitForReviewPanel();
      const badges = await reviewPanel.getAttributeBadges();

      // At least one badge must contain a percent sign indicating reduction.
      const hasReducedBadge = badges.some((label) => /\d+\s*%/.test(label));
      expect(
        hasReducedBadge,
        `Expected a "% reduced" badge but got: ${JSON.stringify(badges)}`
      ).toBe(true);

      await reviewPanel.approve();
    }
  );

  /**
   * T4: Original message collapsible section shows raw PII; processed prompt does NOT.
   *
   * The review panel renders two views of the message:
   *   - Processed prompt (default): placeholders instead of raw PII
   *   - Original message (collapsible): the raw text as the user typed it
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault: person name
   *  3. Send message containing the name
   *  4. Wait for review panel
   *  5. Read getProcessedPrompt() — assert raw name NOT present
   *  6. Read getOriginalMessage() — assert raw name IS present
   *  7. Re-read getProcessedPrompt() — confirm placeholder still present (not overwritten)
   */
  test(
    "original message collapsible shows raw PII; processed prompt does NOT",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [{ text: PERSON_NAME, category: "person name" }]);

      const chatPage = new ChatPage(page);
      await stubCloudApi(page, STUB_RESPONSE);

      await chatPage.sendMessage(
        `My client is ${PERSON_NAME} and they need tax advice.`
      );

      const reviewPanel = await chatPage.waitForReviewPanel();

      // 1. Processed prompt must NOT contain the raw name.
      const processedPrompt = await reviewPanel.getProcessedPrompt();
      await verifyRedaction(processedPrompt, PERSON_NAME);

      // Processed prompt must contain a vault placeholder token.
      await verifyPlaceholder(processedPrompt, /\[VAULT_PERSON_NAME_\d+\]/);

      // 2. Original message section must contain the raw name.
      const originalMessage = await reviewPanel.getOriginalMessage();
      expect(originalMessage.toLowerCase()).toContain(
        PERSON_NAME.toLowerCase()
      );

      // 3. Processed prompt has not been contaminated by expanding the original.
      const processedPromptAfter = await reviewPanel.getProcessedPrompt();
      await verifyRedaction(processedPromptAfter, PERSON_NAME);

      await reviewPanel.approve();
    }
  );

  /**
   * T5: Categorical attribute tokens in the processed prompt match [ATTR_*] pattern.
   *
   * When categorical attribute substitution is active, the processed prompt
   * must contain tokens of the form [ATTR_<CATEGORY>] or [VAULT_*] — not the
   * raw PII values.  No raw PII must appear anywhere in the processed output.
   *
   * Steps:
   *  1. Seed settings: privacyMode=hybrid
   *  2. Seed vault with multiple PII categories
   *  3. Send message containing the seeded PII values
   *  4. Wait for review panel
   *  5. Read getProcessedPrompt()
   *  6. Assert processed prompt matches /\[ATTR_\w+\]/ OR /\[VAULT_\w+_\d+\]/
   *  7. Assert no raw PII values appear in processed prompt
   */
  test(
    "categorical attribute tokens in processed prompt match placeholder patterns",
    async ({ page }) => {
      await page.goto(APP_URL);

      await seedSettings(page, { privacyMode: "hybrid" });
      await seedVault(page, [
        { text: PERSON_NAME, category: "person name" },
        { text: INCOME_AMOUNT, category: "income amount" },
        { text: EMAIL_ADDRESS, category: "email address" },
      ]);

      const chatPage = new ChatPage(page);
      await stubCloudApi(page, STUB_RESPONSE);

      const cloudPayload = await captureCloudPayload(page, async () => {
        await chatPage.sendMessage(
          `I am ${PERSON_NAME}. My income is ${INCOME_AMOUNT}. ` +
            `Send the documents to ${EMAIL_ADDRESS}.`
        );

        const reviewPanel = await chatPage.waitForReviewPanel();
        const processedPrompt = await reviewPanel.getProcessedPrompt();

        // The processed prompt must contain at least one placeholder token.
        // Vault-seeded entries produce [VAULT_*_N] tokens; attribute extraction
        // may produce [ATTR_*] tokens — either pattern is acceptable.
        const hasPlaceholder =
          /\[VAULT_\w+_\d+\]/.test(processedPrompt) ||
          /\[ATTR_\w+\]/.test(processedPrompt);

        expect(
          hasPlaceholder,
          `Expected at least one [VAULT_*] or [ATTR_*] placeholder token ` +
            `in the processed prompt but got: "${processedPrompt}"`
        ).toBe(true);

        // No raw PII values must remain in the processed prompt.
        await verifyRedaction(processedPrompt, PERSON_NAME);
        await verifyRedaction(processedPrompt, INCOME_AMOUNT);
        await verifyRedaction(processedPrompt, EMAIL_ADDRESS);

        await reviewPanel.approve();
      });

      // Cloud payload must also be free of raw PII.
      await verifyNoPII(cloudPayload, [PERSON_NAME, INCOME_AMOUNT, EMAIL_ADDRESS]);
    }
  );
});

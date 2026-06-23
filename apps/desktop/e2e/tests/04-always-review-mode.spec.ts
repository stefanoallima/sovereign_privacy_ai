// e2e/tests/04-always-review-mode.spec.ts
//
// Tests for the "Always Review Before Send" setting (§ 3.4 of design.md).
//
// When alwaysReviewBeforeSend is true the PromptReviewPanel must appear for
// EVERY outgoing message — including plain messages that contain no PII.
// These tests verify enforcement, the cancel/restore flow, the interaction
// with the separate skipCloudReview flag, and the combined GLiNER + always-
// review path.
//
// Architecture notes:
//   - Import `test` from fixtures/index (not fixtures/app) so the Tauri IPC
//     stub is injected via addInitScript before React mounts.
//   - Import `seedSettings` from fixtures/index too — it also uses
//     addInitScript so settings land in localStorage before the app reads them.
//   - The IPC stub (global-setup.ts) returns no PII by default:
//       detect_pii      → { entities: [], redacted: <input text> }
//       detect_pii_with_gliner → []
//     Test 5 overrides detect_pii_with_gliner via page.addInitScript to
//     simulate PII detection through the GLiNER path.
//   - SettingsPage.toggleAlwaysReview() changes the live UI setting; use it
//     after page.goto() when testing the disable flow (test 4).
//   - ReviewPanel POM: waitForVisible(), approve(), cancel(),
//     getPiiRedactionCount().

import { test, expect, seedSettings } from "../fixtures/index";
import { ChatPage } from "../pages/ChatPage";
import { ReviewPanel } from "../pages/ReviewPanel";
import { SettingsPage } from "../pages/SettingsPage";

const APP_URL = "http://localhost:5173";

// ---------------------------------------------------------------------------
// Test 1 — Review panel shown even when no PII detected (plain message)
// ---------------------------------------------------------------------------

test.describe("always-review-mode", () => {
  test("review panel shown even when no PII detected (plain message)", async ({
    page,
  }) => {
    // Seed settings with alwaysReviewBeforeSend = true before the app boots.
    await seedSettings(page, { alwaysReviewBeforeSend: true });
    await page.goto(APP_URL);

    const chat = new ChatPage(page);

    // "hello" contains no PII — the IPC stub confirms that (returns empty entities).
    // The panel must still appear because alwaysReviewBeforeSend overrides the
    // "only show panel when PII found" gate.
    await chat.sendMessage("hello");

    const panel = new ReviewPanel(page);
    await panel.waitForVisible();

    // Panel is present — confirm it by checking the approve button is rendered.
    await expect(page.getByTestId("review-approve")).toBeVisible();

    // Approve so the test ends in a clean state.
    await panel.approve();
  });

  // ---------------------------------------------------------------------------
  // Test 2 — Send blocked until user explicitly clicks "Approve & Send"
  // ---------------------------------------------------------------------------

  test("send blocked until user explicitly clicks Approve & Send", async ({
    page,
  }) => {
    await seedSettings(page, { alwaysReviewBeforeSend: true });
    await page.goto(APP_URL);

    const chat = new ChatPage(page);
    const panel = new ReviewPanel(page);

    await chat.sendMessage("What is the weather today?");

    // Panel must be visible — send is gated behind it.
    await panel.waitForVisible();

    // The chat input should be cleared/disabled while the review panel is open,
    // which means further sends cannot bypass the review.
    // We verify this by confirming the panel is still visible before any approval.
    await expect(page.getByTestId("prompt-review")).toBeVisible();

    // Now click Approve & Send — the panel should disappear.
    await panel.approve();

    // After approval the panel closes (POM waits for hidden state).
    await expect(page.getByTestId("prompt-review")).toBeHidden();

    // The input field should be cleared (message was consumed).
    const inputValue = await page.getByTestId("chat-input").inputValue();
    expect(inputValue).toBe("");
  });

  // ---------------------------------------------------------------------------
  // Test 3 — Cancel from review panel returns message to input field unchanged
  // ---------------------------------------------------------------------------

  test("cancel from review panel returns message to input field unchanged", async ({
    page,
  }) => {
    await seedSettings(page, { alwaysReviewBeforeSend: true });
    await page.goto(APP_URL);

    const chat = new ChatPage(page);
    const panel = new ReviewPanel(page);

    const originalMessage = "Tell me about Dutch tax brackets";

    await chat.sendMessage(originalMessage);

    // Panel appears.
    await panel.waitForVisible();

    // Cancel the review.
    await panel.cancel();

    // Panel must be gone.
    await expect(page.getByTestId("prompt-review")).toBeHidden();

    // Original message text must be restored in the input field.
    const restoredText = await page.getByTestId("chat-input").inputValue();
    expect(restoredText).toBe(originalMessage);
  });

  // ---------------------------------------------------------------------------
  // Test 4 — Disabling always-review: plain messages skip review panel
  // ---------------------------------------------------------------------------

  test("disabling always-review mode: plain messages skip review panel", async ({
    page,
  }) => {
    // Start with always-review ON so we can verify it works, then turn it off.
    await seedSettings(page, { alwaysReviewBeforeSend: true });
    await page.goto(APP_URL);

    const chat = new ChatPage(page);
    const settings = new SettingsPage(page);
    const panel = new ReviewPanel(page);

    // Step 1: confirm always-review is active (panel appears for plain message).
    await chat.sendMessage("first plain message");
    await panel.waitForVisible();
    await panel.approve();

    // Step 2: disable always-review via the Settings UI.
    await settings.toggleAlwaysReview(false);
    await settings.closeSettings();

    // Step 3: send another plain message — this time the panel must NOT appear.
    // The IPC stub returns no PII, so there is no reason for the panel unless
    // always-review is still on.
    await chat.sendMessage("second plain message no pii");

    // Wait a short time to allow any panel to potentially appear, then assert
    // it remains hidden.
    const panelVisible = await page
      .getByTestId("prompt-review")
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    expect(panelVisible).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test 5 — always-review + GLiNER: both redaction and review fire correctly
  // ---------------------------------------------------------------------------

  test("always-review + GLiNER: both redaction and review fire correctly", async ({
    page,
  }) => {
    // Override the detect_pii_with_gliner stub to return one PII entity so that
    // redaction fires alongside the always-review gate.
    // This must be done via addInitScript so it runs before React boots and
    // replaces the default stub handler.
    await page.addInitScript(`
      (function () {
        var _origInvoke = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke;

        function patchedInvoke(cmd, args) {
          if (cmd === 'detect_pii_with_gliner') {
            // Return a single detected entity so GLiNER redaction fires.
            return Promise.resolve([
              {
                text: "Jan de Vries",
                label: "PERSON",
                score: 0.95,
                start: 0,
                end: 12,
              },
            ]);
          }
          if (cmd === 'detect_pii') {
            // Simulate the regex/rule-based pass also catching the name.
            var input = (args && args.text) || '';
            return Promise.resolve({
              entities: [{ text: "Jan de Vries", label: "PERSON" }],
              redacted: input.replace(/Jan de Vries/g, '[PERSON_1]'),
            });
          }
          // Fall through to the original stub for everything else.
          if (typeof _origInvoke === 'function') return _origInvoke(cmd, args);
          return Promise.resolve(null);
        }

        // The main stub script runs after this one (both are addInitScript),
        // so we patch __TAURI_INTERNALS__ after the page loads by re-patching
        // in a DOMContentLoaded listener — this way we overwrite the stub.
        document.addEventListener('DOMContentLoaded', function () {
          if (window.__TAURI_INTERNALS__) {
            window.__TAURI_INTERNALS__.invoke = patchedInvoke;
          }
          if (window.__TAURI__ && window.__TAURI__.core) {
            window.__TAURI__.core.invoke = patchedInvoke;
          }
        }, { once: true });
      })();
    `);

    await seedSettings(page, {
      alwaysReviewBeforeSend: true,
      glinerEnabled: true,
    });
    await page.goto(APP_URL);

    const chat = new ChatPage(page);
    const panel = new ReviewPanel(page);

    // Message containing a PII name that the patched GLiNER stub will detect.
    await chat.sendMessage("Jan de Vries wants to know about tax deductions");

    // Review panel must appear (from always-review).
    await panel.waitForVisible();

    // The redaction count badge should indicate at least one redaction from
    // the GLiNER / rule-based path.  A count of 0 would mean redaction did not
    // fire; we expect >= 1.
    const redactionCount = await panel.getPiiRedactionCount();
    expect(redactionCount).toBeGreaterThanOrEqual(1);

    // The processed prompt shown in the panel must not contain the raw PII name.
    const processedPrompt = await panel.getProcessedPrompt();
    expect(processedPrompt.toLowerCase()).not.toContain("jan de vries");

    // Approve to finish cleanly.
    await panel.approve();
  });

  // ---------------------------------------------------------------------------
  // Test 6 — skipCloudReview=true does NOT suppress always-review (regression guard)
  // ---------------------------------------------------------------------------

  test("skipCloudReview=true does not suppress always-review panel (regression guard)", async ({
    page,
  }) => {
    // Both flags set: always-review should take precedence over skipCloudReview.
    // The design doc (§ 3.4) explicitly states this as a regression guard:
    //   "settings.skipCloudReview must not override always-review".
    await seedSettings(page, {
      alwaysReviewBeforeSend: true,
      skipCloudReview: true,
    });
    await page.goto(APP_URL);

    const chat = new ChatPage(page);
    const panel = new ReviewPanel(page);

    await chat.sendMessage("plain message with both flags set");

    // The panel MUST still appear despite skipCloudReview=true.
    // If it does not appear within the timeout the test fails with a clear
    // message from ReviewPanel.waitForVisible().
    await panel.waitForVisible();

    // Confirm the approve button is accessible — the panel is fully rendered.
    await expect(page.getByTestId("review-approve")).toBeVisible();

    await panel.approve();
  });
});

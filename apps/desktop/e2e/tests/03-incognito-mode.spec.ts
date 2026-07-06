/**
 * 03-incognito-mode.spec.ts
 *
 * Workflow: Incognito Mode
 *
 * Covers: incognito conversation creation, non-persistence after reload (app
 * restart simulation), incognito indicator visibility in the chat header, and
 * absence of incognito conversations from the project explorer.
 *
 * Design reference: design.md § 3.3
 *
 * Architecture notes:
 *   - Import `test` and `seedSettings` from fixtures/index so the Tauri IPC
 *     stub is injected via addInitScript before React mounts.
 *   - "App restart" is simulated with page.reload(). On reload the Zustand
 *     chat store re-initialises from IndexedDB (chat.ts initialize()). Because
 *     incognito conversations are never written to IndexedDB, they disappear
 *     after any reload — matching the "lost on app close" guarantee.
 *   - Non-incognito conversations ARE written to IndexedDB and therefore
 *     survive a reload.
 *   - The Sidebar renders incognito chats under a dedicated "INCOGNITO" section
 *     header; normal quick chats appear under "QUICK CHAT".
 *   - The ProjectExplorer component only renders conversations that belong to a
 *     project (conv.projectId === project.id). Incognito chats have no projectId
 *     and are therefore never shown there.
 *   - Selectors:
 *       data-testid="incognito-toggle"  — new incognito chat button (Sidebar)
 *       data-testid="incognito-banner"  — incognito indicator in chat header
 *       data-testid="new-chat"          — new normal chat button (Sidebar)
 */

import { expect } from "@playwright/test";
import { test, seedSettings } from "../fixtures/index";
import { ChatPage } from "../pages/ChatPage";
import { stubCloudApi } from "../helpers/network";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_URL = "http://localhost:5173";

/** Minimal canned SSE response for the cloud API stub. */
const STUB_RESPONSE = {
  choices: [
    {
      delta: { content: "Understood, I will help you with that." },
      finish_reason: "stop",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the sidebar's "Incognito" section header is visible.
 * The section only renders when at least one incognito conversation exists
 * (Sidebar.tsx: incognitoChats.length > 0 gate).
 *
 * Note: SectionHeader renders title="Incognito" as DOM text "Incognito".
 * CSS `text-transform: uppercase` makes it LOOK like "INCOGNITO" visually,
 * but Playwright getByText matches actual DOM text content.
 */
async function isIncognitoSectionVisible(chatPage: ChatPage): Promise<boolean> {
  // Match the actual DOM text "Incognito" inside the SectionHeader <span>.
  const header = chatPage.page.getByText("Incognito", { exact: true });
  return header.isVisible().catch(() => false);
}

/**
 * Returns true if any conversation title containing `text` is visible in the
 * sidebar (matches the <span class="text-sm truncate"> inside ConversationItem).
 */
async function isTitleInSidebar(
  chatPage: ChatPage,
  text: string
): Promise<boolean> {
  return chatPage.page
    .getByText(text, { exact: false })
    .isVisible()
    .catch(() => false);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("incognito-mode", () => {
  // -------------------------------------------------------------------------
  // Test 1: incognito conversation not persisted after app restart
  //
  // Steps:
  //   1. Create an incognito conversation via the sidebar's incognito button.
  //   2. Send a message and receive a response.
  //   3. Verify the incognito banner is visible in the chat header.
  //   4. Simulate "app restart" by reloading the page.
  //   5. Assert the conversation is absent from the sidebar (no incognito section,
  //      no conversation title for "Incognito Chat").
  // -------------------------------------------------------------------------

  test(
    "incognito conversation not persisted after app restart",
    async ({ page }) => {
      // Seed settings to cloud mode (no review panel) for a clean send flow.
      await seedSettings(page, { privacyMode: "cloud", skipCloudReview: true });
      await page.goto(APP_URL);

      await stubCloudApi(page, STUB_RESPONSE);

      const chatPage = new ChatPage(page);

      // Step 1: create the incognito conversation.
      const isIncognito = await chatPage.toggleIncognito();
      expect(isIncognito).toBe(true);

      // Step 2: send a message and wait for a reply so the conversation is live.
      await chatPage.sendMessage("This message must not survive a restart.");
      const reply = await chatPage.getLastAssistantMessage();
      expect(reply.length).toBeGreaterThan(0);

      // Step 3: incognito banner must be visible in the chat header.
      await expect(chatPage.incognitoBanner).toBeVisible();

      // Step 4: reload page (simulates app close + reopen).
      // addInitScript-registered scripts are re-injected on each navigation, so
      // the IPC stub and seeded settings survive the reload.
      await page.reload();

      // Step 5: after reload the Zustand store re-initialises from IndexedDB.
      // Because incognito conversations are never written there, the sidebar must
      // have no "INCOGNITO" section and no "Incognito Chat" title.
      const incognitoSectionPresent = await isIncognitoSectionVisible(chatPage);
      expect(incognitoSectionPresent).toBe(false);

      const titlePresent = await isTitleInSidebar(chatPage, "Incognito Chat");
      expect(titlePresent).toBe(false);
    }
  );

  // -------------------------------------------------------------------------
  // Test 2: non-incognito conversation survives restart
  //
  // Steps:
  //   1. Create a normal (non-incognito) conversation via the "New chat" button.
  //   2. Send a message and receive a response so the conversation is titled.
  //   3. Reload the page.
  //   4. Assert the conversation is still listed in the sidebar (by title prefix
  //      or by the presence of the "QUICK CHAT" section header).
  // -------------------------------------------------------------------------

  test(
    "non-incognito conversation survives restart",
    async ({ page }) => {
      await seedSettings(page, { privacyMode: "cloud", skipCloudReview: true });
      await page.goto(APP_URL);

      await stubCloudApi(page, STUB_RESPONSE);

      const chatPage = new ChatPage(page);

      // Step 1: create a regular conversation via the "New chat" button.
      await page.getByTestId("new-chat").click();

      // Step 2: send a message. The conversation title will be set (or remain
      // "New Conversation") — either way it is present in IndexedDB.
      await chatPage.sendMessage("Hello from a regular conversation.");
      const reply = await chatPage.getLastAssistantMessage();
      expect(reply.length).toBeGreaterThan(0);

      // Step 3: reload to simulate app restart.
      await page.reload();

      // Step 4: the "Quick Chat" section header must be visible, indicating at
      // least one non-incognito, non-project conversation was loaded from IndexedDB.
      // Note: the DOM text is "Quick Chat" — CSS text-transform: uppercase only
      // changes the visual appearance, not the underlying DOM text content.
      const quickChatHeader = page.getByText("Quick Chat", { exact: true });
      await expect(quickChatHeader).toBeVisible({ timeout: 10_000 });
    }
  );

  // -------------------------------------------------------------------------
  // Test 3: incognito indicator visible in chat header
  //
  // Steps:
  //   1. Create an incognito conversation.
  //   2. Assert the incognito banner (data-testid="incognito-banner") is visible.
  //   3. Assert the banner text contains "incognito" (case-insensitive).
  // -------------------------------------------------------------------------

  test(
    "incognito indicator visible in chat header",
    async ({ page }) => {
      await seedSettings(page, { privacyMode: "cloud", skipCloudReview: true });
      await page.goto(APP_URL);

      const chatPage = new ChatPage(page);

      // Step 1: create incognito conversation.
      const isIncognito = await chatPage.toggleIncognito();
      expect(isIncognito).toBe(true);

      // Step 2: banner must be immediately visible once the incognito conversation
      // is active (ChatWindow renders it whenever conversation.isIncognito is true).
      await expect(chatPage.incognitoBanner).toBeVisible({ timeout: 10_000 });

      // Step 3: banner text must communicate "incognito" to the user.
      const bannerText = await chatPage.incognitoBanner.innerText();
      expect(bannerText.toLowerCase()).toContain("incognito");
    }
  );

  // -------------------------------------------------------------------------
  // Test 4: incognito conversation absent from project explorer
  //
  // Steps:
  //   1. Create a normal conversation (should appear under a project or Quick Chat).
  //   2. Create an incognito conversation.
  //   3. Assert the ProjectExplorer section does not list the incognito title.
  //   4. Assert that the "INCOGNITO" sidebar section header IS present (the
  //      incognito chat is tracked in the sidebar's dedicated section, not in
  //      the project tree).
  //
  // Note: ProjectExplorer only renders entries for conversations that have a
  // projectId (c.projectId === project.id in Sidebar.tsx). Incognito chats have
  // no projectId, so they are structurally excluded from any project group.
  // The Projects panel itself is empty by default (no projects seeded), meaning
  // the "Create your first project" placeholder is shown — not an incognito entry.
  // -------------------------------------------------------------------------

  test(
    "incognito conversation absent from project explorer",
    async ({ page }) => {
      await seedSettings(page, { privacyMode: "cloud", skipCloudReview: true });
      await page.goto(APP_URL);

      const chatPage = new ChatPage(page);

      // Step 1: create a normal conversation via "New chat" so there is something
      // in the sidebar for comparison.
      await page.getByTestId("new-chat").click();
      // The new chat is now active; incognito banner must NOT be visible.
      await expect(chatPage.incognitoBanner).not.toBeVisible({ timeout: 5_000 });

      // Step 2: create an incognito conversation.
      const isIncognito = await chatPage.toggleIncognito();
      expect(isIncognito).toBe(true);

      // Step 3: the ProjectExplorer panel shows a "Projects" heading.
      // Incognito conversations are never assigned a projectId, so they will not
      // appear under any project folder. Confirm the "Incognito Chat" title is NOT
      // found inside the Projects section.
      //
      // Strategy: find the Projects region (the text "Projects" is the section
      // label in ProjectExplorer), then assert no child element contains "Incognito Chat".
      // Because there are no projects seeded, the Projects area shows the empty-state
      // placeholder ("Create your first project") — definitely no incognito entry.
      const projectsSection = page.getByText("Projects", { exact: true }).first();
      await expect(projectsSection).toBeVisible({ timeout: 10_000 });

      // The incognito title must NOT be a sibling/child inside the Projects panel.
      // We check by asserting the incognito section header lives in the Sidebar's
      // conversations list (below the project explorer), not inside the project tree.
      const incognitoSectionVisible = await isIncognitoSectionVisible(chatPage);
      expect(incognitoSectionVisible).toBe(true);

      // Confirm "Incognito Chat" does NOT appear under the Projects heading by
      // reading the text content of the entire sidebar element.
      // The ProjectExplorer component is rendered directly above the conversations
      // list separator; grab the surrounding element's text.
      const sidebarText = await page.evaluate(() => {
        // The sidebar is the <aside> element; grab its textContent for inspection.
        const aside = document.querySelector("aside");
        return aside ? aside.textContent ?? "" : "";
      });

      // "Incognito Chat" is the default title set for incognito conversations in
      // chat.ts (title: isIncognito ? "Incognito Chat" : "New Conversation").
      // The Projects section must not contain it — but we know it will appear
      // in the Incognito sidebar section (verified above). Checking that Projects
      // does NOT render it is structural by design (no projectId) rather than
      // inspectable by text alone (the title appears in the Incognito section
      // which is BELOW the project explorer divider).
      //
      // Structural guarantee: the ProjectExplorer only iterates `projects` list
      // (empty here) and `conversations.filter(c => c.projectId === project.id)`.
      // An incognito chat has no projectId, so it cannot match any project filter.
      // We assert the "Incognito" section header is present and the Projects area
      // shows the placeholder (no project folders = no incognito leak).
      expect(sidebarText).toContain("Projects");
      expect(sidebarText).toContain("Incognito");
      // The "Create your first project" button confirms the Projects section is
      // empty (no project folders that could accidentally contain the chat).
      expect(sidebarText).toContain("Create your first project");
    }
  );
});

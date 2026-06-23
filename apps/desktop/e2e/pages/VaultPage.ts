/**
 * VaultPage — Page Object Model for the PII Vault
 * (src/components/settings/VaultBrowser.tsx, rendered inside the Settings
 * dialog's "Privacy & Local" tab).
 *
 * Encapsulates opening the vault, adding/listing/deleting entries, exporting,
 * and clearing all entries.
 *
 * data-testid selectors used (added to the components):
 *   open-settings / settings-dialog / settings-tab-privacy — navigation
 *   pii-vault                     — vault root container
 *   vault-add-entry               — "Add Entry" button (opens the form)
 *   vault-add-form                — the add-entry form
 *   vault-entry-text / -category  — add-form inputs
 *   vault-entry-save              — add-form submit button
 *   vault-search                  — search input
 *   vault-entry                   — one entry row (carries data-entry-* attrs)
 *   vault-entry-delete            — per-row delete button
 *   vault-export                  — "Export Vault" button (triggers a download)
 *   vault-clear-all               — "Clear All" button (opens confirm dialog)
 *   vault-clear-confirm-button    — confirm button inside the clear dialog
 *
 * Each entry row exposes its data via attributes so reads are robust to layout:
 *   data-entry-text, data-entry-category, data-entry-placeholder
 */

import type { Locator, Page } from "@playwright/test";

const TIMEOUT = 10_000;

export interface VaultEntry {
  text: string;
  category: string;
  placeholder: string;
}

export class VaultPage {
  readonly page: Page;
  readonly settingsDialog: Locator;
  readonly openSettingsButton: Locator;
  readonly privacyTab: Locator;
  readonly vault: Locator;

  constructor(page: Page) {
    this.page = page;
    this.settingsDialog = page.getByTestId("settings-dialog");
    this.openSettingsButton = page.getByTestId("open-settings");
    this.privacyTab = page.getByTestId("settings-tab-privacy");
    this.vault = page.getByTestId("pii-vault");
  }

  /**
   * Navigates to Settings → Privacy & Local → PII Vault and waits for the vault
   * to be visible. Idempotent: skips steps already satisfied.
   *
   * @throws if any navigation step fails within the timeout.
   */
  async openVault(): Promise<void> {
    if (!(await this.settingsDialog.isVisible().catch(() => false))) {
      try {
        await this.openSettingsButton.click({ timeout: TIMEOUT });
        await this.settingsDialog.waitFor({ state: "visible", timeout: TIMEOUT });
      } catch {
        throw new Error(
          `[VaultPage] Could not open the Settings dialog ` +
            `([data-testid="open-settings"] / [data-testid="settings-dialog"]) within ${TIMEOUT}ms.`
        );
      }
    }
    try {
      await this.privacyTab.click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[VaultPage] Privacy tab ([data-testid="settings-tab-privacy"]) ` +
          `not clickable within ${TIMEOUT}ms.`
      );
    }
    try {
      await this.vault.waitFor({ state: "visible", timeout: TIMEOUT });
      // The vault sits at the bottom of the privacy tab; bring it into view.
      await this.vault.scrollIntoViewIfNeeded();
    } catch {
      throw new Error(
        `[VaultPage] PII Vault ([data-testid="pii-vault"]) ` +
          `did not become visible within ${TIMEOUT}ms.`
      );
    }
  }

  /**
   * Adds a vault entry via the Add Entry form: opens the form, fills the text
   * and category, and submits. Assumes the vault is already open.
   *
   * @param text     the sensitive text to store (e.g. "Jan de Vries").
   * @param category the PII category (e.g. "person name").
   * @throws if the form controls are not available within the timeout.
   */
  async addEntry(text: string, category: string): Promise<void> {
    const form = this.vault.getByTestId("vault-add-form");
    if (!(await form.isVisible().catch(() => false))) {
      try {
        await this.vault.getByTestId("vault-add-entry").click({ timeout: TIMEOUT });
        await form.waitFor({ state: "visible", timeout: TIMEOUT });
      } catch {
        throw new Error(
          `[VaultPage] Could not open the add-entry form ` +
            `([data-testid="vault-add-entry"] / [data-testid="vault-add-form"]) within ${TIMEOUT}ms.`
        );
      }
    }
    try {
      await form.getByTestId("vault-entry-text").fill(text, { timeout: TIMEOUT });
      await form
        .getByTestId("vault-entry-category")
        .fill(category, { timeout: TIMEOUT });
      await form.getByTestId("vault-entry-save").click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[VaultPage] Could not fill/submit the add-entry form for ` +
          `"${text}" / "${category}" within ${TIMEOUT}ms.`
      );
    }
    // Wait until the new entry row is present so callers can rely on it.
    try {
      await this.entryRow(text).waitFor({ state: "attached", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[VaultPage] Entry "${text}" did not appear in the vault after saving.`
      );
    }
  }

  /**
   * Reads all currently displayed vault entries.
   *
   * @returns one object per row with its text, category, and placeholder.
   */
  async getEntries(): Promise<VaultEntry[]> {
    const rows = this.vault.getByTestId("vault-entry");
    const count = await rows.count();
    const entries: VaultEntry[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      entries.push({
        text: (await row.getAttribute("data-entry-text")) ?? "",
        category: (await row.getAttribute("data-entry-category")) ?? "",
        placeholder: (await row.getAttribute("data-entry-placeholder")) ?? "",
      });
    }
    return entries;
  }

  /**
   * Deletes the entry whose stored text matches `text`. The delete button is
   * revealed on row hover, so the row is hovered first.
   *
   * @param text the exact entry text to remove.
   * @throws if the matching row or its delete button is not found within the timeout.
   */
  async deleteEntry(text: string): Promise<void> {
    const row = this.entryRow(text);
    try {
      await row.waitFor({ state: "visible", timeout: TIMEOUT });
      // Delete/edit buttons are opacity-0 until group-hover.
      await row.hover();
    } catch {
      throw new Error(
        `[VaultPage] Vault entry with text "${text}" not found within ${TIMEOUT}ms.`
      );
    }
    try {
      await row.getByTestId("vault-entry-delete").click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[VaultPage] Delete button for entry "${text}" not clickable within ${TIMEOUT}ms.`
      );
    }
    // Deletion is immediate (no confirm dialog for single rows); wait for removal.
    await row.waitFor({ state: "detached", timeout: TIMEOUT }).catch(() => {
      /* If a duplicate text exists the row may remain; leave for caller. */
    });
  }

  /**
   * Clicks "Export Vault" and captures the downloaded JSON.
   *
   * VaultBrowser builds the file from a Blob URL and triggers an anchor click,
   * which Playwright surfaces as a download event. The file contents (the
   * exported JSON string) are returned.
   *
   * @returns the exported file's text content (JSON).
   * @throws if no download is produced within the timeout.
   */
  async exportVault(): Promise<string> {
    const exportBtn = this.vault.getByTestId("vault-export");
    try {
      await exportBtn.waitFor({ state: "visible", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[VaultPage] Export button ([data-testid="vault-export"]) not found ` +
          `within ${TIMEOUT}ms (the button only renders when entries exist).`
      );
    }
    let download;
    try {
      [download] = await Promise.all([
        this.page.waitForEvent("download", { timeout: TIMEOUT }),
        exportBtn.click(),
      ]);
    } catch {
      throw new Error(
        `[VaultPage] No download was triggered by Export Vault within ${TIMEOUT}ms.`
      );
    }
    // Read the downloaded file's contents via its on-disk path.
    const fs = await import("fs/promises");
    const path = await download.path();
    if (!path) {
      throw new Error(
        `[VaultPage] Export download has no accessible file path.`
      );
    }
    return fs.readFile(path, "utf-8");
  }

  /**
   * Clicks "Clear All", then confirms in the resulting dialog. Waits for the
   * vault to empty.
   *
   * @throws if the clear/confirm controls are not available within the timeout.
   */
  async clearAll(): Promise<void> {
    const clearBtn = this.vault.getByTestId("vault-clear-all");
    try {
      await clearBtn.waitFor({ state: "visible", timeout: TIMEOUT });
      await clearBtn.click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[VaultPage] Clear All button ([data-testid="vault-clear-all"]) ` +
          `not available within ${TIMEOUT}ms (only renders when entries exist).`
      );
    }
    const confirmBtn = this.page.getByTestId("vault-clear-confirm-button");
    try {
      await confirmBtn.waitFor({ state: "visible", timeout: TIMEOUT });
      await confirmBtn.click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[VaultPage] Clear-all confirm button ` +
          `([data-testid="vault-clear-confirm-button"]) not available within ${TIMEOUT}ms.`
      );
    }
    // After clearing, no entry rows should remain.
    await this.vault
      .getByTestId("vault-entry")
      .first()
      .waitFor({ state: "detached", timeout: TIMEOUT })
      .catch(() => {
        /* Already empty (no rows to detach) — acceptable. */
      });
  }

  /** Locator for the entry row whose stored text equals `text`. */
  private entryRow(text: string): Locator {
    return this.vault.locator(
      `[data-testid="vault-entry"][data-entry-text="${cssEscapeAttr(text)}"]`
    );
  }
}

/** Escapes a value for safe use inside a CSS attribute-selector string. */
function cssEscapeAttr(value: string): string {
  // Escape backslashes and double-quotes for an attribute selector in quotes.
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

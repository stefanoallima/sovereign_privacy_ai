/**
 * SettingsPage — Page Object Model for the Settings dialog
 * (src/components/settings/SettingsDialog.tsx + PrivacySettings.tsx).
 *
 * Encapsulates opening/closing the dialog and the privacy-critical controls
 * that live under the "Privacy & Local" tab: the default privacy-mode radios,
 * the "Always review before send" toggle, and the GLiNER (Privacy Guard) toggle.
 *
 * data-testid selectors used (added to the components):
 *   open-settings          — sidebar "Settings" button   (Sidebar.tsx)
 *   settings-dialog        — dialog root                  (SettingsDialog.tsx)
 *   settings-close         — dialog close (X) button
 *   settings-tab-privacy   — "Privacy & Local" tab button
 *   privacy-mode-local|hybrid|cloud — radio inputs        (PrivacySettings.tsx)
 *   toggle-always-review   — "Always review before send" checkbox
 *   toggle-gliner          — "Privacy Guard (GLiNER)" checkbox
 */

import type { Locator, Page } from "@playwright/test";

const TIMEOUT = 10_000;

export type PrivacyMode = "local" | "hybrid" | "cloud";

export class SettingsPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly openButton: Locator;
  readonly closeButton: Locator;
  readonly privacyTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId("settings-dialog");
    this.openButton = page.getByTestId("open-settings");
    this.closeButton = page.getByTestId("settings-close");
    this.privacyTab = page.getByTestId("settings-tab-privacy");
  }

  /**
   * Opens the Settings dialog by clicking the sidebar Settings button (a no-op
   * if the dialog is already open).
   *
   * @throws if neither the dialog nor the open button is available within the timeout.
   */
  async openSettings(): Promise<void> {
    if (await this.dialog.isVisible().catch(() => false)) return;
    try {
      await this.openButton.click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[SettingsPage] Settings button ([data-testid="open-settings"]) ` +
          `not clickable within ${TIMEOUT}ms.`
      );
    }
    try {
      await this.dialog.waitFor({ state: "visible", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[SettingsPage] Settings dialog ([data-testid="settings-dialog"]) ` +
          `did not open within ${TIMEOUT}ms.`
      );
    }
  }

  /**
   * Ensures the dialog is open and the "Privacy & Local" tab is active, so the
   * privacy controls are mounted. Internal helper for the toggle/mode methods.
   */
  private async openPrivacyTab(): Promise<void> {
    await this.openSettings();
    try {
      await this.privacyTab.click({ timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[SettingsPage] Privacy tab ([data-testid="settings-tab-privacy"]) ` +
          `not clickable within ${TIMEOUT}ms.`
      );
    }
  }

  /**
   * Selects the default privacy mode (Local / Hybrid / Cloud) via its radio.
   *
   * @param mode the privacy mode to activate.
   * @throws if the radio is not present/enabled within the timeout (e.g. Local
   *         is disabled when no local model is downloaded).
   */
  async setPrivacyMode(mode: PrivacyMode): Promise<void> {
    await this.openPrivacyTab();
    const radio = this.page.getByTestId(`privacy-mode-${mode}`);
    try {
      await radio.waitFor({ state: "visible", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[SettingsPage] Privacy-mode radio ([data-testid="privacy-mode-${mode}"]) ` +
          `not found within ${TIMEOUT}ms.`
      );
    }
    if (!(await radio.isEnabled())) {
      throw new Error(
        `[SettingsPage] Privacy-mode radio "${mode}" is disabled ` +
          `(e.g. Local mode requires a downloaded local model).`
      );
    }
    await radio.check({ timeout: TIMEOUT });
  }

  /**
   * Sets the "Always review before send" toggle to the requested state. Idempotent:
   * does nothing if the toggle already matches `enabled`.
   *
   * @param enabled desired checked state.
   * @throws if the toggle is not present within the timeout.
   */
  async toggleAlwaysReview(enabled: boolean): Promise<void> {
    await this.openPrivacyTab();
    await this.setCheckbox(
      this.page.getByTestId("toggle-always-review"),
      enabled,
      "toggle-always-review"
    );
  }

  /**
   * Sets the GLiNER (Privacy Guard) toggle to the requested state. Idempotent:
   * does nothing if the toggle already matches `enabled`.
   *
   * @param enabled desired checked state.
   * @throws if the toggle is not present within the timeout.
   */
  async toggleGliner(enabled: boolean): Promise<void> {
    await this.openPrivacyTab();
    await this.setCheckbox(
      this.page.getByTestId("toggle-gliner"),
      enabled,
      "toggle-gliner"
    );
  }

  /**
   * Closes the Settings dialog (clicks the X, falling back to Escape) and waits
   * for it to disappear. A no-op if the dialog is already closed.
   *
   * @throws if the dialog is still visible after the timeout.
   */
  async closeSettings(): Promise<void> {
    if (!(await this.dialog.isVisible().catch(() => false))) return;
    const closed = await this.closeButton
      .click({ timeout: TIMEOUT })
      .then(() => true)
      .catch(() => false);
    if (!closed) {
      // Fallback: press Escape.
      await this.page.keyboard.press("Escape");
    }
    try {
      await this.dialog.waitFor({ state: "hidden", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[SettingsPage] Settings dialog still visible ${TIMEOUT}ms after close.`
      );
    }
  }

  /** Drives a checkbox to the desired state, only clicking when it differs. */
  private async setCheckbox(
    checkbox: Locator,
    enabled: boolean,
    testId: string
  ): Promise<void> {
    try {
      await checkbox.waitFor({ state: "visible", timeout: TIMEOUT });
    } catch {
      throw new Error(
        `[SettingsPage] Toggle ([data-testid="${testId}"]) not found within ${TIMEOUT}ms.`
      );
    }
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enabled) {
      // setChecked clicks only as needed and re-verifies the resulting state.
      await checkbox.setChecked(enabled, { timeout: TIMEOUT });
    }
  }
}

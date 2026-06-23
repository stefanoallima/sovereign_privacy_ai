// e2e/tests/00-stub-smoke.spec.ts
// Trivial smoke test: verifies that the Tauri IPC stub is injected correctly
// and all required invoke() commands resolve without a compiled Tauri binary.

import { test, expect } from "../fixtures/index";

test.describe("Tauri IPC stub", () => {
  test("detect_pii returns empty entities", async ({ page }) => {
    await page.goto("http://localhost:5173");

    const result = await page.evaluate(async () => {
      return (window as any).__TAURI_INTERNALS__.invoke("detect_pii", {
        text: "My name is John Smith",
      });
    });

    expect(result).toEqual({ entities: [], redacted: "My name is John Smith" });
  });

  test("detect_pii_with_gliner returns empty array", async ({ page }) => {
    await page.goto("http://localhost:5173");

    const result = await page.evaluate(async () => {
      return (window as any).__TAURI_INTERNALS__.invoke(
        "detect_pii_with_gliner",
        { text: "My email is test@example.com" }
      );
    });

    expect(result).toEqual([]);
  });

  test("get_app_settings returns valid AppSettings", async ({ page }) => {
    await page.goto("http://localhost:5173");

    const result = await page.evaluate(async () => {
      return (window as any).__TAURI_INTERNALS__.invoke("get_app_settings");
    });

    expect(result).toMatchObject({
      alwaysReviewBeforeSend: false,
      skipCloudReview: false,
      preferredBackend: "hybrid",
    });
  });

  test("get_conversations returns empty array", async ({ page }) => {
    await page.goto("http://localhost:5173");

    const result = await page.evaluate(async () => {
      return (window as any).__TAURI_INTERNALS__.invoke("get_conversations");
    });

    expect(result).toEqual([]);
  });

  test("window.__TAURI__ is present (feature detection guard)", async ({
    page,
  }) => {
    await page.goto("http://localhost:5173");

    const hasTauri = await page.evaluate(() => "__TAURI__" in window);
    expect(hasTauri).toBe(true);
  });
});

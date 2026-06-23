import type { Page } from "@playwright/test";

/**
 * Converts a JSON chunk object into SSE (Server-Sent Events) format.
 * The final signal `data: [DONE]\n\n` is appended automatically.
 *
 * Example output for { choices: [{ delta: { content: "Hello" } }] }:
 *   data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n
 *   data: [DONE]\n\n
 */
export function toSSE(chunk: object): string {
  return `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
}

/**
 * Intercepts all POST requests to "**\/v1\/chat\/completions" and immediately
 * fulfills them with a canned SSE response built from the given response object.
 *
 * The request body is NOT consumed here — the route handler fulfills without
 * forwarding, so you cannot use captureCloudRequest on the same page after
 * calling stubCloudApi (they both register routes for the same URL pattern
 * and the first matching route wins). If you need to both capture and stub,
 * use captureCloudPayload with an action callback instead.
 *
 * @param page     Playwright Page object.
 * @param response Plain object that will be JSON-serialised into the SSE body.
 */
export async function stubCloudApi(
  page: Page,
  response: object
): Promise<void> {
  await page.route("**/v1/chat/completions", async (route) => {
    // Preserve the raw request body so test code can inspect it after the call.
    // Playwright stores the intercepted request; tests can call
    //   route.request().postData()
    // on the request object if they hold a reference to the route.
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSSE(response),
    });
  });
}

/**
 * Registers a one-shot route that captures and returns the parsed JSON body
 * of the next POST to "**\/v1\/chat\/completions", then lets the request continue
 * normally (so the real or stubbed handler can still process it).
 *
 * Call this **before** triggering any action that would send a cloud request.
 *
 * @param page Playwright Page object.
 * @returns    Parsed JSON object from the request body.
 */
export function captureCloudRequest(page: Page): Promise<object> {
  return new Promise((resolve) => {
    void page.route("**/v1/chat/completions", async (route) => {
      const raw = route.request().postData() ?? "{}";
      const body = JSON.parse(raw) as object;
      resolve(body);
      // Let the request proceed so the app receives a response.
      await route.continue();
    });
  });
}

/**
 * Convenience wrapper: sets up the capture route, runs `action`, then returns
 * the intercepted request payload.
 *
 * Typical usage in a test:
 *
 *   const payload = await captureCloudPayload(page, async () => {
 *     await chatPage.sendMessage("My salary is EUR 72.000");
 *     await reviewPanel.approve();
 *   });
 *   await verifyNoPII(payload, ["EUR 72.000"]);
 *
 * @param page   Playwright Page object.
 * @param action Async callback whose execution is expected to trigger a cloud
 *               request to "**\/v1\/chat\/completions".
 * @returns      Parsed JSON object from the intercepted request body.
 */
export async function captureCloudPayload(
  page: Page,
  action: () => Promise<void>
): Promise<object> {
  const bodyPromise = captureCloudRequest(page);
  await action();
  return bodyPromise;
}

# Proposal: Implement Frontend E2E Tests for Privacy Workflows

**ID:** green_frontend-e2e-tests_09  
**Title:** Set up Playwright E2E test suite for privacy-critical UI flows  
**Size:** L (large)  
**Persona:** All three (Margot, David, Aisha)  
**Priority:** 2  

## Why

The alignment report identifies **GAP011**: Frontend testing is absent. Currently:
- Zero .test.tsx/.spec.tsx files (no Jest/Vitest tests)
- No E2E tests (Playwright config not observed)
- Only manual testing mentioned
- Privacy-critical components (PromptReviewPanel, PiiVault, PiiConfirmationPanel) have zero automated tests

**Why it matters:** Margot, David, and Aisha all depend on the privacy UI working correctly. Without E2E tests:
- Prompt review can silently break (review panel doesn't render)
- PII redaction can regress (old values not redacted in new release)
- Vault operations can fail silently (entries don't persist)
- Incognito mode can leak data (chats saved when they shouldn't be)

A privacy feature regression discovered in production is catastrophic for trust. E2E tests catch these regressions before users encounter them.

**Scope:** This proposal is large because we're building test infrastructure from scratch. We prioritize privacy-critical workflows (redaction, review, approval, vault) over less critical flows (settings, persona selection).

## Current State

- **Testing:** Rust backend has `cargo test` support; frontend has zero automated tests
- **Manual testing:** "pnpm tauri dev" in dev mode (reliant on developer discipline)
- **Risk:** Privacy features (PII detection, redaction, prompt review) can break silently
- **CI/CD:** No test step; release depends on manual testing

## Desired State

1. **Playwright E2E test infrastructure:**
   - `playwright.config.ts` configured for Tauri app
   - Test runner in CI/CD pipeline
   - All tests passing on Windows (primary platform)

2. **Privacy workflow test suite:**
   - **Chat → Redaction → Review → Approval flow:**
     - User enters chat with PII (name, amount)
     - System detects PII and redacts in preview
     - PromptReviewPanel shows redacted prompt
     - User clicks Approve
     - Redacted prompt is sent to cloud (verify no raw PII in request)
   
   - **PII Vault operations:**
     - Add vault entry (manual)
     - Send chat with matching PII
     - Verify vault entry is substituted
     - Edit vault entry
     - Delete vault entry
     - Export vault as JSON
   
   - **Incognito Mode:**
     - Enable Incognito for a chat
     - Send messages
     - Close app
     - Reopen app
     - Verify Incognito chat is not in history
   
   - **Always Review mode (GAP006):**
     - Enable "Always Review Before Send"
     - Send message
     - Verify PromptReviewPanel appears and approval is required
   
   - **Prompt Transparency (baseline):**
     - Send message in hybrid mode
     - Verify PromptReviewPanel shows categorical attributes (not raw PII)
     - Click Approve
     - Verify cloud request contains only categorical attributes

3. **Component tests (optional, post-v1):**
   - Jest/Vitest for non-privacy components (settings, sidebar, etc.)
   - E2E focuses on critical workflows; unit tests cover helper functions

## Acceptance Criteria

1. **Playwright is configured** — `playwright.config.ts` exists, tests can run via `pnpm test:e2e`
2. **Test suite runs in CI** — GitHub Actions (or equivalent) runs E2E tests on every commit
3. **Privacy workflow tests pass** — All 5 critical workflows (chat→redaction→review, vault ops, incognito, always-review, prompt-transparency) have passing tests
4. **No regressions detected** — Tests would catch common regressions (redaction broken, vault not persisting, incognito leaking, review panel missing)
5. **Test coverage is documented** — README lists which workflows are E2E tested
6. **Tests are maintainable** — Clear test structure, well-commented, easy to add new scenarios

## Dependencies

- Depends on: green_incognito-mode_04, green_pii-vault-ui_05, green_always-review-mode_08 (these features need to exist to test)
- Unblocks: Confidence for shipping privacy features without manual regression testing

## Effort Justification

**L (Large) — 3–4 weeks (15–20 business days)**

**Complexity breakdown:**

1. **Playwright infrastructure setup:** (2–3 days)
   - Install Playwright + dependencies
   - Configure for Tauri app (non-standard setup)
   - Set up test runner, reporters, CI integration
   - Document test environment and how to run locally

2. **Test framework & utilities:** (2–3 days)
   - Create test helpers (login, navigate to chat, fill form, check elements)
   - Page object models for reusability (ChatPage, SettingsPage, VaultPage)
   - Assertion helpers for privacy checks (verify redaction, verify no PII in request)
   - Mock cloud API (or use real Nebius API with test credentials)

3. **Privacy workflow tests:** (5–7 days)
   - **Chat → Redaction → Review → Approval:** 1–2 days
     - Test flow from fresh chat to redacted prompt to approval
     - Verify PromptReviewPanel renders with correct placeholders
     - Verify approval sends only categorical attributes
   
   - **PII Vault operations:** 1–2 days
     - Add/edit/delete/export vault entries
     - Verify vault entries are substituted in chat
     - Verify export format is correct
   
   - **Incognito Mode:** 1 day
     - Enable Incognito, send messages, close app, reopen, verify chat is gone
   
   - **Always Review mode:** 1 day
     - Enable Always Review, send message, verify review panel blocks send, approve and verify send works
   
   - **Prompt Transparency baseline:** 0.5 days
     - Verify categorical attributes in redacted prompt
     - Verify no raw PII in cloud request

4. **Edge cases & error handling:** (2–3 days)
   - Network errors: sending fails, retry works
   - Vault conflicts: duplicate entries, edit during send
   - Incognito state: switch in/out of incognito mid-conversation
   - Review rejection: user clicks Cancel in review panel

5. **CI/CD integration & documentation:** (1–2 days)
   - GitHub Actions workflow to run tests
   - README section: "Testing the app locally and in CI"
   - Test maintenance guide for future developers

6. **Debugging & stabilization:** (2–3 days)
   - Flaky test fixes (race conditions, async operations)
   - Performance optimization (parallel test runs)
   - Screenshot/video capture on failure for debugging

**Why it's L and not M:**
- Playwright setup for Tauri is non-standard (requires custom configuration)
- Privacy workflows are complex and multi-step (chat → redaction → review → approval)
- Testing network interactions requires mocking or special setup
- Large scope: 5 critical workflows × multiple scenarios each

**Why it's not XL:**
- Scope is bounded (5 workflows, not entire app)
- Playwright is well-documented
- No complex distributed systems testing
- Most tests are straightforward "do X, verify Y" patterns

## Alignment Gap

**Reference:** GAP011 (Frontend Testing Absent)

**Report excerpt:**
> "Privacy-critical components (PromptReviewPanel, PiiVault, PiiConfirmationPanel) have zero automated tests... Without E2E tests, regressions in these components are undetected until users report them. This is a risk for the product's core promise ('transparency,' 'control')."

This proposal adds the missing test infrastructure and coverage for privacy workflows.

## Test Writing Approach

Example test (pseudo-code):
```typescript
test('Chat → Redaction → Review → Approval flow', async ({ page }) => {
  // 1. Start app and navigate to chat
  await page.goto('app://localhost');
  
  // 2. Enter chat with PII
  await chatPage.sendMessage('My client Acme Corp owes me €5000');
  
  // 3. Verify redaction in review panel
  const reviewPanel = await page.locator('[data-test-id="prompt-review"]');
  const redactedPrompt = await reviewPanel.textContent();
  expect(redactedPrompt).toContain('[CLIENT_NAME]');
  expect(redactedPrompt).toContain('[AMOUNT]');
  expect(redactedPrompt).not.toContain('Acme Corp');
  expect(redactedPrompt).not.toContain('5000');
  
  // 4. Approve and verify cloud request
  await reviewPanel.click('button:has-text("Approve")');
  const requests = await page.context().network;
  expect(requests.last().postData()).not.toContain('Acme Corp');
});
```

## CI/CD Integration

GitHub Actions step:
```yaml
- name: Run E2E tests
  run: pnpm test:e2e
```

## Future Enhancement (Post-v1)

- Visual regression testing: Screenshots of UI for comparison across releases
- Performance testing: Ensure privacy features don't slow down the app
- Stress testing: Multiple rapid chats, large vault, etc.
- Accessibility testing: Ensure privacy UI is accessible (WCAG 2.1)

## Success Metric

After this ships:
1. All privacy workflow tests pass locally and in CI
2. Future changes that break privacy features are caught by tests before merge
3. New developers can run `pnpm test:e2e` to verify no regressions
4. Margot, David, and Aisha can trust that privacy features won't regress silently

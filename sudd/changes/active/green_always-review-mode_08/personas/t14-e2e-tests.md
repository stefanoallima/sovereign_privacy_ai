# Micro-Persona: T14 — End-to-End Tests

## Who Am I?

I'm the **Real-World Validator** — the end-to-end (E2E) tests that run in a real browser, simulating David's actual usage of the feature.

## My Role in This Change

Unit tests check code logic. Integration tests check component wiring. I test the ACTUAL feature as David experiences it: Can he find the toggle? Can he click it? Does the review modal appear? Can he click approve? Does his message actually send? I'm the proof that the feature works for real users.

## Success Looks Like

- ✓ User flow: navigate to Settings → Privacy → toggle Always Review → setting saved
- ✓ User flow: enable toggle → send message → modal appears with correct content
- ✓ User flow: modal shows "Approve & Send" and "Reject" buttons
- ✓ User flow: click Approve → message sends → appears in chat
- ✓ User flow: click Reject → message blocked → does not appear in chat
- ✓ User flow: badge "🛈 Review Enabled" visible when toggle ON
- ✓ User flow: local persona → send without review modal
- ✓ 25+ E2E test scenarios covering major user journeys

## Risk If Done Wrong

- E2E tests don't reflect real user experience
- Tests fail randomly (flaky, due to timing issues)
- Tests are slow (10+ minutes, blocks releases)
- Tests don't catch visual bugs (button styling, layout)
- Tests miss accessibility issues
- Tests break easily when UI changes

## Key Inputs I Need

- E2E testing framework (Cypress, Playwright, WebdriverIO, etc.)
- How to start dev server for testing
- Where to find test data (login credentials, test personas, etc.)
- Visual regression testing tools (optional but nice)
- CI/CD environment setup for E2E tests

## Key Outputs I Create

- E2E test file(s) with 25+ test scenarios
- Page objects/helpers for common interactions (enable toggle, send message, etc.)
- Screenshots/video recording on test failure (debugging aid)
- Test data setup (test users, personas, etc.)
- Clear test descriptions explaining user journey

## Testing I Must Pass

- All E2E tests pass locally and in CI
- Tests complete in < 10 minutes
- Tests are deterministic (pass reliably, no flakiness)
- Visual elements appear correctly (badge, buttons, modal)
- Accessibility verified (keyboard navigation, screen reader)
- Major user journeys covered
- Failure screenshots captured for debugging

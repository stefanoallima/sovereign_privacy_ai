# Micro-Persona: T13 — Integration Tests

## Who Am I?

I'm the **Flow Validator** — the integration tests that verify the pieces of the feature work together correctly.

## My Role in This Change

Unit tests verify individual functions. I verify that the whole review flow works: user toggles setting → sends message → modal appears → clicks approve → message sends → event logged. I catch integration bugs that unit tests can't see.

## Success Looks Like

- ✓ Full review flow tests (toggle + send + approve = message sent + logged)
- ✓ Full rejection flow tests (toggle + send + reject = message blocked + logged)
- ✓ Local backend bypass tests (toggle ON + local persona = no modal, send proceeds)
- ✓ Modal non-dismissibility tests (Escape/X/click-outside don't close)
- ✓ Badge visibility tests (toggle ON = badge visible, OFF = hidden)
- ✓ Settings persistence across app reload
- ✓ Concurrent action handling (user clicks approve while send is processing)
- ✓ 35+ integration tests covering all major flows

## Risk If Done Wrong

- Integration tests don't catch cross-component bugs
- Tests don't reflect real user workflows
- Tests are slow (10+ minutes, too slow for CI)
- Tests are brittle (break when UI changes slightly)
- Coverage gaps (some flows untested)
- Flaky tests (pass sometimes, fail randomly)

## Key Inputs I Need

- Integration testing framework (possibly same as unit tests)
- How to set up app state for testing (store initialization)
- Whether to use real components or mocks
- Test scenarios from specs.md and design.md
- Performance budgets (how long integration tests can take)

## Key Outputs I Create

- Integration test file(s) with 35+ test cases
- Test setup/teardown for app state
- Test utilities for common operations (enable toggle, send message, etc.)
- Test data factories (sample personas, backends, messages)
- Clear test descriptions explaining what flow is being tested

## Testing I Must Pass

- All integration tests pass locally and in CI
- Tests reflect real user workflows
- No test interdependencies (can run in any order)
- Tests run in < 2 minutes total
- All major user paths covered
- Edge cases handled (missing data, network errors, etc.)

# Micro-Persona: T12 — Unit Tests

## Who Am I?

I'm the **Code Validator** — the unit tests that verify each piece of the feature works in isolation before it's assembled into the full system.

## My Role in This Change

I catch bugs early, before they combine into a broken feature. I test the review gate logic, settings persistence, modal state management, and logging independently. My job is to ensure that T01-T11 each do exactly what they're supposed to do.

## Success Looks Like

- ✓ Settings persistence tests (5+ cases)
- ✓ Local vs cloud backend detection (8+ cases)
- ✓ Review gate logic tests (10+ cases)
- ✓ Modal state management tests (6+ cases)
- ✓ confirmSendMessage() logic tests (8+ cases)
- ✓ Audit logging function tests (8+ cases)
- ✓ 95%+ code coverage of review gate and settings
- ✓ All tests pass locally and in CI

## Risk If Done Wrong

- Tests don't exist (no confidence in code quality)
- Tests are flaky (fail randomly, break CI pipeline)
- Coverage is low (bugs hiding in untested code)
- Tests don't match actual code behavior (false confidence)
- Tests slow down CI (takes hours to run)
- Tests are impossible to understand (no one can maintain them)

## Key Inputs I Need

- Testing framework used in the app (Jest, Vitest, Mocha, etc.)
- Existing test patterns to follow (test structure, mocking patterns)
- How to mock appSettings, chatStore, analytics
- Test data (sample personaIds, backends, timestamps)
- Coverage thresholds (95% minimum?)

## Key Outputs I Create

- Unit test files for each component (appSettings.test.ts, useInference.test.ts, etc.)
- 40+ unit tests covering all logic paths
- Mocking setup for external dependencies
- Test utilities/helpers for common operations
- Test documentation (what each test verifies)

## Testing I Must Pass

- All unit tests pass locally
- 95%+ code coverage of review logic
- No flaky tests (deterministic, no random failures)
- Tests run in < 30 seconds
- All edge cases covered (null values, undefined, etc.)
- Mocking works correctly (no accidental real calls)

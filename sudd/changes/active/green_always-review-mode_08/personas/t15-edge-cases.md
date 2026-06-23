# Micro-Persona: T15 — Edge Case Testing

## Who Am I?

I'm the **Chaos Tester** — the tests that verify the feature works correctly when things go wrong or unusual situations happen.

## My Role in This Change

Unit/integration/E2E tests verify the happy path. I verify the sad path: What if the network fails during approval? What if the user quickly toggles the setting on/off? What if they switch personas mid-message? I catch the weird edge cases that happen in the real world.

## Success Looks Like

- ✓ Toggle changed during message composition (new setting applies to next send)
- ✓ User rejects send, then immediately clicks send again (works correctly)
- ✓ Network error occurs during approval (user gets error dialog, but logged)
- ✓ Hybrid mode persona handling (treated as cloud, review required)
- ✓ Multi-persona conversation (each persona's logs have correct personaId)
- ✓ App closes with modal open (state cleared, no crash on restart)
- ✓ User presses Ctrl+Enter while modal open (keyboard shortcut doesn't bypass review)
- ✓ 8+ edge case scenarios

## Risk If Done Wrong

- Edge cases cause crashes (app becomes unreliable)
- Feature works in happy path but fails in real usage
- User discovers bypass and loses trust in the feature
- State corruption when app closes during review
- Concurrent requests cause duplicate sends or lost events

## Key Inputs I Need

- List of edge cases from specs.md and design.md
- How to simulate network errors in tests
- Keyboard event simulation (Ctrl+Enter)
- App lifecycle hooks (on app close, restart)
- Test scenarios and expected outcomes

## Key Outputs I Create

- Edge case test file with 8+ scenarios
- Setup code for simulating network errors
- Keyboard event handlers for shortcut testing
- Test utilities for app restart simulation
- Clear documentation of each edge case

## Testing I Must Pass

- All edge case tests pass
- No crashes in any edge case scenario
- Correct behavior in each scenario
- No security bypasses found
- Feature remains reliable even in unusual situations

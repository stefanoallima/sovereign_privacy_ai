# Micro-Persona: T05 — Disable Send Button During Review

## Who Am I?

I'm the **Send Button Guard** — I disable the send button while the review modal is open, preventing accidental double-sends.

## My Role in This Change

While David is reviewing a message, I make sure he can't click Send again (either accidentally or intentionally). I'm a secondary safety mechanism that reinforces: "First finish reviewing this message, then you can send the next one."

## Success Looks Like

- ✓ Send button is clearly disabled (visual feedback: reduced opacity, not-allowed cursor)
- ✓ Send button is disabled ONLY when `reviewModal.pending !== null`
- ✓ Send button becomes re-enabled immediately after review clears
- ✓ User cannot submit form via keyboard (Ctrl+Enter) while button is disabled
- ✓ Button state matches the actual modal state (no lag or sync issues)
- ✓ Visual disabled state is obvious (user immediately understands they can't send)

## Risk If Done Wrong

- Button appears enabled but doesn't work (user clicks repeatedly, confused)
- Button is disabled when it shouldn't be (traps user, can't send anything)
- Button state doesn't sync with modal state (UI inconsistency)
- Button disables but doesn't visually show it (user doesn't understand why nothing happens)
- Keyboard shortcut still works even though button is disabled (inconsistent behavior)

## Key Inputs I Need

- Current Send button implementation in ChatWindow.tsx
- How to read `reviewModal.pending` state from the store
- Styling approach for disabled state (opacity, cursor, etc.)
- Whether keyboard shortcuts (Ctrl+Enter) should also be blocked
- Confirmation that ChatWindow.tsx is the right place for this

## Key Outputs I Create

- Modify Send button's `disabled` attribute to read from store state
- CSS/styling for disabled button appearance
- Optional: keyboard event handler to block shortcuts while pending
- Logic to re-enable button when modal clears

## Testing I Must Pass

- Unit test: Button disabled when pending
- Unit test: Button enabled when pending cleared
- Integration test: Button state syncs with modal state
- Integration test: Keyboard shortcuts blocked while pending
- Integration test: Button re-enabled after approval
- Integration test: Button re-enabled after rejection
- E2E test: User cannot click send while modal open

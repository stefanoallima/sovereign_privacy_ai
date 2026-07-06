# Micro-Persona: T08 — Modal Non-Dismissible Configuration (CRITICAL)

## Who Am I?

I'm the **Modal Fortress** — the configuration that prevents David from closing the review modal except by clicking Approve or Reject.

## My Role in This Change

I'm the guarantee behind David's trust in the feature. If David can close the modal by pressing Escape or clicking outside, the entire review system becomes security theater. I make sure the modal is impossible to dismiss except through explicit user action (Approve or Reject).

## Success Looks Like

- ✓ Escape key does NOT close modal (`onEscape={null}`)
- ✓ X button does NOT exist or is hidden (`display: none` or removed entirely)
- ✓ Clicking outside modal does NOT close it (`onBackdropClick={null}`)
- ✓ Tab focus is trapped within modal (cannot tab out)
- ✓ ONLY "Approve" and "Reject" buttons can dismiss the modal
- ✓ User cannot accidentally dismiss the modal through any gesture
- ✓ Modal is frustration-free but foolproof

## Risk If Done Wrong

- Escape key closes modal (CRITICAL: user bypasses review)
- X button visible and clickable (CRITICAL: user bypasses review)
- Click outside dismisses modal (CRITICAL: user bypasses review)
- Tab focus allows user to escape modal (CRITICAL: keyboard navigation bypass)
- Modal style suggests it's dismissible (misleads user)
- Modal is so restrictive it frustrates users (they feel trapped)
- Configuration is incomplete (one dismissal method missed)

## Key Inputs I Need

- Current Modal/Dialog component API in the app
- How to disable Escape key (`onEscape={null}` syntax varies)
- How to hide or remove the X button
- How to disable backdrop click (`onBackdropClick={null}`)
- How to implement focus trap (TabbablePanel or similar)
- Confirmation of which Modal component is used (MUI, custom, etc.)

## Key Outputs I Create

- Modal config with `onEscape={null}` (Escape disabled)
- X button removal or `display: none` CSS
- Modal config with `onBackdropClick={null}` (backdrop click disabled)
- Focus trap implementation (Tab stays within modal)
- Comments explaining why each dismissal method is blocked

## Testing I Must Pass

- Unit test: Modal has `onEscape={null}`
- Unit test: X button not rendered or hidden
- Unit test: Modal has `onBackdropClick={null}`
- Integration test: Focus trap prevents tabbing out
- E2E test: Escape key does not close modal
- E2E test: X button not visible or not functional
- E2E test: Clicking outside does not close modal
- E2E test: Tab/Shift-Tab stays within modal
- E2E test: ONLY Approve/Reject buttons work

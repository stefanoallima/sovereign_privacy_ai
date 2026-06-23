# Micro-Persona: T07 — Modal Approve/Reject Buttons

## Who Am I?

I'm the **Decision Point** — the Approve and Reject buttons that give David the power to control what leaves his machine.

## My Role in This Change

I'm where David makes the final decision: Does this message get sent? I must be clear, responsive, and give him confidence that clicking me has the right effect. "Approve" sends the message; "Reject" blocks it. Nothing else.

## Success Looks Like

- ✓ "Approve & Send" button (blue, primary style) — clear that this sends
- ✓ "Reject" button (gray, secondary style) — clear that this blocks
- ✓ Clicking Approve calls `confirmSendMessage('approve')`
- ✓ Clicking Reject calls `confirmSendMessage('reject', reason)`
- ✓ Reject button opens optional textarea for rejection reason
- ✓ Buttons are the ONLY way to dismiss the modal
- ✓ Buttons are keyboard accessible (Tab to focus, Enter/Space to click)
- ✓ Button labels are clear and unambiguous

## Risk If Done Wrong

- Buttons are confusing (user clicks "Reject" expecting to approve)
- Approve button doesn't actually send (user clicks repeatedly, confused)
- Reject button hides but doesn't actually block send
- Buttons don't respond to clicks (stuck modal)
- Rejection reason textarea appears/disappears unpredictably
- Buttons work with mouse but not keyboard
- User can click buttons while previous action is still processing (double-click issue)

## Key Inputs I Need

- Current PromptReviewPanel.tsx structure
- UI button components used elsewhere in app (for consistency)
- How to call `confirmSendMessage()` from React event handlers
- Whether there's a design system for button colors (blue = primary, gray = secondary)
- Confirmation that rejection reason is truly optional

## Key Outputs I Create

- "Approve & Send" button with click handler
- "Reject" button with click handler
- Optional rejection reason textarea/input
- Button styling (primary and secondary)
- Keyboard event handling for accessibility

## Testing I Must Pass

- Unit test: Approve button calls confirmSendMessage('approve')
- Unit test: Reject button calls confirmSendMessage('reject')
- Integration test: Approve sends message
- Integration test: Reject blocks send
- Integration test: Rejection reason captured (optional)
- E2E test: Buttons work with mouse click
- E2E test: Buttons work with keyboard (Tab + Enter)
- E2E test: Approve actually sends the message
- E2E test: Reject actually blocks the message

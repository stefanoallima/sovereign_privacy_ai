# Micro-Persona: T09 — Confirm Send Function

## Who Am I?

I'm the **Action Router** — `confirmSendMessage()` — the function that processes David's decision (Approve or Reject).

## My Role in This Change

I'm the bridge between the modal buttons and the actual send (or block). When David clicks Approve, I make sure the message actually sends. When he clicks Reject, I make sure the message is blocked and logged. I'm the point where intent becomes action.

## Success Looks Like

- ✓ Function signature: `confirmSendMessage(action: 'approve' | 'reject', reason?: string)`
- ✓ Approve path: log event → clear modal → call `performActualSend()`
- ✓ Reject path: log event → clear modal → do NOT send
- ✓ Both paths call audit logging (T10)
- ✓ Modal state (`reviewModal.pending`) cleared after action
- ✓ No errors even if send fails (logging still happens)
- ✓ Function is synchronous and fast (no hanging)

## Risk If Done Wrong

- Approve clicked but message never sends (user doesn't realize)
- Reject clicked but message still sends (CRITICAL: safety bypass)
- Modal doesn't clear after action (user stuck)
- Logging fails silently, no audit trail
- Function crashes if send fails
- Race condition: approve and reject both processed somehow
- Message sent twice if user clicks approve twice

## Key Inputs I Need

- Current `performActualSend()` function in useInference.ts
- How to call `logPromptReviewGate()` (T10)
- How to call `clearReviewModal()` (T02)
- What rejection reasons are acceptable
- Error handling patterns used elsewhere in hooks

## Key Outputs I Create

- `confirmSendMessage(action, reason)` function
- Conditional logic: approve vs reject paths
- Calls to `logPromptReviewGate()` for audit
- Calls to `clearReviewModal()` for state cleanup
- Calls to `performActualSend()` for approve path only
- Error handling that logs even if send fails

## Testing I Must Pass

- Unit test: Approve path sends message
- Unit test: Reject path blocks message
- Unit test: Both paths call logging
- Unit test: Modal cleared after action
- Integration test: Approve processes send successfully
- Integration test: Reject blocks send completely
- Integration test: Logging called with correct action type
- Integration test: Modal visible immediately after action
- E2E test: Approve → message appears in chat
- E2E test: Reject → message does not appear

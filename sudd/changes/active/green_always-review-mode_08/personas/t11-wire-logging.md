# Micro-Persona: T11 — Wire Logging to Review Flow

## Who Am I?

I'm the **Integration Point** — the code that connects the modal buttons to the audit logging system.

## My Role in This Change

T09 (confirmSendMessage) and T10 (logPromptReviewGate) exist but aren't connected yet. I wire them together so that every approve/reject decision gets logged automatically. I'm the glue that makes the audit trail work.

## Success Looks Like

- ✓ When `confirmSendMessage('approve')` is called, `logPromptReviewGate('approved_for_cloud', metadata)` is called
- ✓ When `confirmSendMessage('reject', reason)` is called, `logPromptReviewGate('rejected', metadata)` is called
- ✓ Metadata is passed correctly from modal state to logging
- ✓ All approval events logged
- ✓ All rejection events logged (with rejection reason if provided)
- ✓ Local sends also logged (T09 or elsewhere)
- ✓ No events missed or duplicated

## Risk If Done Wrong

- Logging not called (audit trail empty)
- Only approvals logged, rejections missing (incomplete history)
- Metadata incomplete or wrong (timestamps, persona IDs garbled)
- Logging called twice (duplicate events)
- Rejection reason lost (user didn't provide it)
- Wrong action type logged (approve logged as reject)
- Wiring breaks when modal state changes

## Key Inputs I Need

- Signature of `confirmSendMessage(action, reason)` from T09
- Signature of `logPromptReviewGate(action, metadata)` from T10
- What metadata needs to be passed (personaId, backend, timestamp)
- Where to get metadata from (reviewModal.pending state)
- Whether rejection reason is required or optional

## Key Outputs I Create

- Modified `confirmSendMessage()` to call `logPromptReviewGate()` in both paths
- Metadata extraction from `reviewModal.pending` state
- Function calls with correct action type and metadata
- Comments documenting the wiring

## Testing I Must Pass

- Integration test: Approve calls logPromptReviewGate with 'approved_for_cloud'
- Integration test: Reject calls logPromptReviewGate with 'rejected'
- Integration test: Metadata includes personaId, backend, timestamp
- Integration test: Rejection reason included when provided
- Integration test: All approval events appear in logs
- Integration test: All rejection events appear in logs
- E2E test: User approves, event in audit log
- E2E test: User rejects, event with reason in audit log
- Audit test: Log contains no duplicate events

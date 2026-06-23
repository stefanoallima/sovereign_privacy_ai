# Micro-Persona: T10 — Audit Logging Function

## Who Am I?

I'm the **Audit Trail Keeper** — `logPromptReviewGate()` — the function that records every review action so David can verify what was approved and what was rejected.

## My Role in This Change

Without me, there's no evidence that review happened. David needs to be able to look at his logs and see: "Yes, I approved this send at 3:42 PM from my Tax Advisor." I create the immutable record that proves the review system worked.

## Success Looks Like

- ✓ Function accepts action type: 'approved_for_cloud', 'rejected', 'sent_local', 'sent_local_persona'
- ✓ Metadata logged: timestamp (ISO-8601), personaId, backend, rejectionReason (optional)
- ✓ NO prompt content logged (privacy: users might share sensitive data)
- ✓ Events are timestamped accurately (ISO format, proper timezone)
- ✓ Events are stored so they can be exported/reviewed
- ✓ Logging is fast and non-blocking (< 5ms)
- ✓ Logging doesn't crash if storage is full

## Risk If Done Wrong

- Prompt content logged (PRIVACY BREACH: sensitive data exposed)
- Events don't have accurate timestamps (audit trail is useless)
- Logging fails silently, no record created
- Events are lost (stored nowhere, cannot be reviewed)
- Personal data (user messages) included in logs
- Logging crashes the app
- Log file grows unbounded and consumes all storage

## Key Inputs I Need

- Current analytics.ts structure (how to add functions)
- Existing logging patterns in the app
- Whether analytics uses a third-party service (Sentry, LogRocket, etc.)
- Storage limitations (how many events can we store?)
- Privacy constraints (what data is allowed to log?)
- Timezone handling (should be ISO-8601 with Z for UTC)

## Key Outputs I Create

- `logPromptReviewGate(action, metadata)` function
- Event schema (timestamp, personaId, backend, action, rejectionReason)
- Event storage/transmission (append to analytics, send to service, etc.)
- No prompt content in metadata (filters sensitive data)
- Comments explaining what/why for privacy compliance

## Testing I Must Pass

- Unit test: Approval event logged with correct metadata
- Unit test: Rejection event logged with reason
- Unit test: Local send logged as 'sent_local'
- Unit test: No prompt content in logs
- Unit test: Timestamps are ISO-8601 formatted
- Integration test: Events are stored/transmitted
- Integration test: Events can be retrieved/exported
- E2E test: Logs exported, all actions appear with correct metadata
- Privacy test: No sensitive data found in logs (grep for user inputs)

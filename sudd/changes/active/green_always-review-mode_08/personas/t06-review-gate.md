# Micro-Persona: T06 — Review Gate Check (CRITICAL)

## Who Am I?

I'm the **Security Gate** — the critical logic that decides: "Does this message need review before sending?"

## My Role in This Change

I'm the most important part of the entire feature. David trusts that every cloud send will be reviewed IF he has enabled Always Review. If I fail, even once, that trust is broken. I must never let a cloud message slip through without review.

## Success Looks Like

- ✓ Function correctly identifies local backends (ollama, llama.cpp, local) — these skip review
- ✓ Function correctly identifies cloud backends — these require review if toggle is ON
- ✓ Hybrid mode is treated as cloud-based (requires review)
- ✓ If toggle OFF: skip review for all backends
- ✓ If toggle ON and cloud backend: set `reviewModal.pending` and block send
- ✓ If toggle ON and local backend: proceed with send (no review needed)
- ✓ No edge cases slip through (all backend types handled)

## Risk If Done Wrong

- Cloud message sent without review (CRITICAL: betrays user trust)
- Local message blocked and treated as cloud (user confused, feature broken)
- Toggle ignored: review happens/doesn't happen regardless of setting
- Hybrid mode incorrectly classified, review skipped when it should happen
- New persona types added later, review logic breaks
- Race condition: review gate and toggle check don't sync
- Off-by-one error in backend detection (one backend type not checked)

## Key Inputs I Need

- Understanding of all persona backend types in the app
- Knowledge of how to read `alwaysReviewBeforeSend` toggle from appSettings
- List of backend options (cloud vs local vs hybrid)
- How to detect hybrid mode (is it a persona field or global setting?)
- Confirmation that useInference.ts is the right place

## Key Outputs I Create

- `isLocalBackend(backend, persona)` helper function
- Review gate check at START of `sendMessage()` function
- Clear decision logic: if needsReview, set modal and block; else proceed
- Comprehensive backend type handling

## Testing I Must Pass

- Unit test: Local backend skips review
- Unit test: Cloud backend requires review if toggle ON
- Unit test: Cloud backend skips review if toggle OFF
- Unit test: Hybrid mode treated as cloud
- Unit test: Each backend type (ollama, llama, local, cloud) tested
- Unit test: Toggle OFF skips review for all backends
- Integration test: Full flow (toggle ON + cloud + send = modal appears)
- E2E test: Send with different personas, verify review shows correctly
- CRITICAL: No edge cases allowing cloud send without review

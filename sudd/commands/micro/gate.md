---
name: sudd:gate
description: Persona validation gate — does this deliver value?
phase: validate
micro: true
prereq: sudd:test (tests passing)
creates: validation score
---

Persona validation gate. The critical check: does this deliver actual value?

**Input**:
- `/sudd:gate` — validate active change
- `/sudd:gate {change-id}` — validate specific change
- `/sudd:gate {persona}` — validate as specific persona

---

## ORCHESTRATOR CHECK

## PHASE GUARD
Read sudd/state.json
If tests_passed != true: STOP. "Run /sudd:test first — tests must pass before gate."

```bash
cat sudd/state.json
```

If tests not passing:
- "Tests not passing. Run `/sudd:test` first."
- Or auto-run if autonomous

---

## STEP 1: IDENTIFY CONSUMERS

Read `sudd/changes/active/{id}/specs.md` for consumer handoffs.

Identify ALL consumers:
1. **Immediate consumer** — next component in chain
2. **Downstream consumers** — further in pipeline
3. **End user** — human who uses the feature
4. **AI agents** — other SUDD agents consuming output

---

## STEP 2: FOR EACH CONSUMER

Run in parallel:

```
Task(agent=persona-validator):

PERSONA: {consumer name}
CONTEXT: {from persona-researcher or inferred}
HANDOFF CONTRACT: {from specs}
CODE: {read actual implementation}
TEST RESULTS: {from /sudd:test}

You ARE this consumer. Walk through using the output.

Check:
1. Handoff contract compliance (format, schema, encoding)
2. Deal-breakers addressed
3. Real data, not placeholders
4. Error handling works
5. Documentation usable

Level (from standards.md → Scoring):
  EXEMPLARY:  All requirements met → PASS
  STRONG:     Good but gaps → FAIL
  ACCEPTABLE: Significant issues → FAIL
  WEAK:       Major problems → FAIL
  BROKEN:     Non-functional → FAIL

Feedback: {specific issues}
```

---

## STEP 3: AGGREGATE SCORES

```
Gate: {change-id}

  Consumer: API Client
    Level: EXEMPLARY (97/100)
    Issues: None blocking

  Consumer: Frontend
    Level: EXEMPLARY (95/100)
    Issues: None blocking

  Consumer: End User (Admin)
    Level: EXEMPLARY (98/100)
    Issues: None

  ────────────────────────────
  Lowest Level: EXEMPLARY

  Result: PASS (all EXEMPLARY)
```

---

## STEP 4: PASS/FAIL

### If ALL consumers at EXEMPLARY: PASS
```
Update log.md:
  ## {timestamp}
  - Gate PASSED
  - All consumers: EXEMPLARY
  - All consumers validated

Update state.json:
  phase: "complete"

Next: Run /sudd:done to archive
```

Update sudd/state.json:
  - gate_passed = true
  - gate_score = {minimum_consumer_score}
  - phase = "complete"
  - last_command = "sudd:gate"

### If ANY consumer below EXEMPLARY: FAIL

**Phase transition: validate → build (on retry) — valid**
**Phase transition: validate → complete (on pass) — valid (handled in PASS above)**

```
Update log.md:
  ## {timestamp}
  - Gate FAILED
  - Lowest score: 45/100 (API Client)
  - Feedback: [detailed issues]

APPEND to log.md under "## Accumulated Feedback" section:
  (Create the section if it does not exist yet. NEVER overwrite existing feedback.)

  ## Accumulated Feedback (read this FIRST on retry)
  ### Retry {retry_count} — Gate Score: {min_score}/100
  - Persona "{consumer_name}": {score}/100 — {specific issues}
  - Persona "{consumer_name}": {score}/100 — {specific issues}
  ...for each consumer evaluated in this gate run.

  Each retry APPENDS a new "### Retry N" subsection below the previous ones.
  Previous retry feedback must be preserved verbatim.

retry_count++

If retry < 8:
  → Escalate tier
  → Return to /sudd:apply with feedback
Else:
  → Mark STUCK
  → Run /sudd:done (will archive as stuck)
```

---

## ESCALATION

```
Retry 0-1: Free models (opencode)
Retry 2-3: Sonnet for validation
Retry 4-5: Sonnet for all
Retry 6-7: Opus for all
After 8:   STUCK
```

---

## OUTPUT

### Pass
```
Gate: PASSED ✓

  All consumers validated
  Minimum score: {min}/100

Ready for archive. Run /sudd:done
```

### Fail
```
Gate: FAILED ✗

  Lowest: API Client (45/100)
  
  Issues:
  - Missing pagination support
  - Timeout handling incomplete
  
  Retry: 3/8
  Escalating to Sonnet...
  
  Returning to /sudd:apply with feedback
```

---

## GUARDRAILS

- ALL consumers must be EXEMPLARY level
- Read ACTUAL code, not summaries
- Check for placeholders, not just functionality
- Accumulate ALL feedback across retries
- Always escalate on retry

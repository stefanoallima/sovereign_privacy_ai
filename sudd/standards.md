# SUDD Standards

Shared definitions referenced by all agents. Loaded by context-manager per agent.

## Activation Protocol

Every agent follows this sequence:
1. Check PREREQUISITES — halt if unmet
2. Load context via context-manager
3. Execute process steps
4. Write output to OUTPUTS location
5. Hand off to NEXT agent

## Scoring

All validation uses named rubric levels. Agents select a level and justify with evidence.

| Level | Score | Gate | Criteria |
|-------|-------|------|----------|
| EXEMPLARY | 95-100 | PASS | All requirements met. No gaps. Consumer would use immediately. |
| STRONG | 80-94 | FAIL | Good but has gaps. Consumer needs refinements. |
| ACCEPTABLE | 60-79 | FAIL | Functional but significant issues. Consumer struggles. |
| WEAK | 30-59 | FAIL | Major problems. Consumer cannot use effectively. |
| BROKEN | 0-29 | FAIL | Non-functional or empty. Consumer rejects outright. |

Only EXEMPLARY passes the gate. Every level choice must cite evidence (file:line or specific output).
Do NOT pick a numeric score first then map to level. Pick the level first, then assign a score within that range.

## Handoff Contracts

Every boundary between producers and consumers requires:
- **Format**: exact output structure (JSON, markdown, file, etc.)
- **Schema**: required fields with types
- **Encoding**: UTF-8, URL-encoded, ISO 8601 dates, etc.
- **Completeness**: expected item count or "all"
- **Validation**: how to verify correctness

Silent handoff failures (wrong encoding, missing fields, partial data) are the #1 cause of false "success."

## Agent Invocation

"Task(agent=X)" means:
1. Read `sudd/sudd.yaml` for X's tier
2. Read `sudd/agents/X.md` for instructions
3. Spawn subagent with X.md as prompt + PREREQUISITES files
4. Subagent writes to OUTPUTS location
5. Orchestrator continues to NEXT agent

Independent agents spawn in parallel. Sequential agents wait for predecessor output.

## State Validation

Every command that reads state.json must validate:
1. Valid JSON — if corrupt, restore: `git show HEAD:sudd/state.json > sudd/state.json`
2. `phase` ∈ {inception, planning, build, validate, complete}
3. If `active_change` set → `sudd/changes/active/{active_change}/` exists
4. If active change has tasks.md → `tasks_completed` matches `[x]` count
5. Mismatch → log WARNING, auto-correct from source of truth (tasks.md, git)

## Golden Rules

1. **EXEMPLARY is the threshold.** Only EXEMPLARY passes. No charity, no rounding up.
2. **Empty data = automatic fail.** Mock/placeholder output is never acceptable.
3. **Be specific.** File paths, line numbers, exact field names. No vague feedback.
4. **Handoffs must be explicit.** Define format, encoding, schema at every boundary.
5. **Retry must change approach.** Same approach twice = wasted compute.

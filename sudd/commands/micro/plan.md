---
name: sudd:plan
description: Create specs, design, and tasks for a change
phase: planning
micro: true
prereq: sudd:new (proposal.md)
creates: specs.md, design.md, tasks.md
---

Create detailed specifications, design, and implementation tasks for a change.

**Input**:
- `/sudd:plan` — use active change
- `/sudd:plan {change-id}` — specific change

---

## ORCHESTRATOR CHECK

```bash
cat sudd/state.json
```

If no active change:
1. Check `sudd/changes/active/` for available changes
2. If none: "No changes found. Run `/sudd:new` first."
3. If one: auto-select
4. If multiple: list and ask

If active change has no proposal:
- Run `/sudd:new` first (or auto-create if autonomous)

---

## STEP 1: READ CONTEXT

Read:
- `sudd/vision.md`
- `sudd/changes/active/{id}/proposal.md`
- `sudd/personas/*.md` (if exist)
- `sudd/specs/` for related specs
- Codebase for patterns

---

## STEP 2: RESEARCH (IF NEEDED)

Run research agents if artifacts are missing (not based on mode):
- If `sudd/personas/*.md` contains ONLY `default.md` (no real consumer personas discovered)
- OR if `specs.md` has no `### Handoff:` section (no consumer contracts defined)

This makes research artifact-based, not mode-based. Brown-mode projects that
lack consumer research get the same discovery pass as green-mode projects.

If either condition is true, run research agents:

```
Task(agent=researcher):
  - Investigate technologies needed
  - Find patterns in codebase
  - Identify standards to follow

Task(agent=persona-detector):
  - Discover WHO consumes this output
  - Map consumer chain

Task(agent=persona-researcher):
  - Deep-research each consumer
  - Find deal-breakers, formats, unknown unknowns
```

Aggregate findings.

---

## STEP 3: CREATE SPECS

Write `sudd/changes/active/{id}/specs.md`:

```markdown
# Specifications: {change-id}

## Functional Requirements
### FR-1: {requirement}
- Given: 
- When: 
- Then: 

## Non-Functional Requirements
### NFR-1: {requirement}
- Constraint: 
- Rationale: 

## API Contracts
### Endpoint/Interface: {name}
- Input: {schema}
- Output: {schema}
- Errors: {cases}

## Data Models
### {Model}
- field: type (constraints)

## Consumer Handoffs
### Handoff 1: {Producer} → {Consumer}
- Format: 
- Schema: 
- Validation: 

## Out of Scope
- 
```

---

## STEP 4: CREATE DESIGN

Write `sudd/changes/active/{id}/design.md`:

```markdown
# Design: {change-id}

## Architecture Overview
{ASCII diagram of components}

## Component: {name}
### Responsibility
### Dependencies
### Interface
### Implementation Notes

## Data Flow
{ASCII diagram}

## Sequence Diagrams
{for complex interactions}

## File Changes
### New Files
- path/to/file.py — description

### Modified Files
- path/to/file.py — changes

## Configuration
- New config needed: 
- Env vars: 

## Migration Plan
- Step 1: 
- Step 2: 
```

---

## STEP 5: CREATE TASKS

Write `sudd/changes/active/{id}/tasks.md`:

```markdown
# Tasks: {change-id}

## Implementation Tasks
- [ ] T1: {task description}
  - Files:
  - SharedFiles: {lock files, configs, routers that other tasks may also touch — leave empty if none}
  - Effort: S/M/L
  - Dependencies:

- [ ] T2: {task description}
  - Files:
  - SharedFiles:
  - Effort: S/M/L
  - Dependencies: T1

## Test Tasks
- [ ] T3: Write tests for X
- [ ] T4: Write tests for Y

## Documentation Tasks
- [ ] T5: Update README
- [ ] T6: Add inline docs

---
Total: N tasks | Est. effort: {sum}
```

---

## STEP 6: UPDATE STATE

Update `sudd/state.json`:
```json
{
  "phase": "build",
  "last_command": "sudd:plan"
}
```

---

## OUTPUT

```
Planned: sudd/changes/active/{change-id}/

  proposal.md  ✓ (existing)
  specs.md     ✓ (created)
  design.md    ✓ (created)
  tasks.md     ✓ (created)
  
  Tasks: N total
  Estimated effort: {sum}

Next: Run /sudd:apply to start implementation
```

---

## GUARDRAILS

- Always read proposal first
- Run research when artifacts are missing (personas or handoff contracts), regardless of mode
- Create handoff contracts in specs
- Tasks should be granular (1-2 hours each)
- Update state.json phase to "build"

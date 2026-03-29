---
name: sudd:apply
description: Implement tasks from the task list
phase: build
micro: true
prereq: sudd:plan (specs.md, design.md, tasks.md)
creates: code files
---

Implement tasks from the change’s task list.

**Input**:
- `/sudd:apply` — implement next pending tasks
- `/sudd:apply {task-id}` — implement specific task
- `/sudd:apply all` — implement all pending tasks

---

Agent invocation follows `sudd/standards.md` → Agent Invocation.

---

## ORCHESTRATOR CHECK

## PHASE GUARD
<!-- Phase guard: requires phase >= "build" -->
If phase < "build": STOP. "Run /sudd:plan first."
If specs.md does not exist: STOP. "Run /sudd:plan first — specs.md is required."

```bash
cat sudd/state.json
```

If phase < "build":
- "Planning not complete. Run `/sudd:plan` first."
- Or auto-run if autonomous

If no active change:
- Find available changes
- Auto-select or ask

---

## STEP 1: READ CONTEXT + VALIDATE STATE

Read state.json and validate per `sudd/standards.md` → State Validation.

Read:
- `sudd/sudd.yaml` (agent tiers, cost_mode)
- `sudd/changes/active/{id}/proposal.md`
- `sudd/changes/active/{id}/specs.md`
- `sudd/changes/active/{id}/design.md`
- `sudd/changes/active/{id}/tasks.md`
- `sudd/memory/lessons.md`

---

## STEP 1b: LESSON INJECTION (MANDATORY)

Read `sudd/memory/lessons.md`. For current task, extract tags from:
- Task technology (from design.md file extensions / frameworks)
- Task domain (from proposal.md / specs.md)
- Prior failure patterns (from log.md if retry)

Match lessons by tag overlap. Select top-3 by: tag match count > confidence > recency.

If matches found, include in ALL agent prompts for this task:
```
## Lessons (DO NOT repeat these mistakes)
1. {lesson} (from: {change-id}, confidence: {level})
2. {lesson}
3. {lesson}
```

Log: "Injected {N} lessons for tags: {tags}"
If no matches: Log: "No matching lessons for tags: {tags}"

---

## STEP 2: SHOW PROGRESS

```
Tasks: {change-id}

  ✓ T1: Setup database schema
  ✓ T2: Create model classes
  ○ T3: Implement API endpoints
  ○ T4: Add validation
  ○ T5: Write tests

Progress: 2/5 complete
```

---

## RETRY PROTOCOL (if retry_count > 0)

### For retry 1-2: Full Feedback
1. Read `## Accumulated Feedback` from log.md
2. Read latest critique dispositions from log.md
3. Lessons already injected by STEP 1b
4. Include in coder's prompt:

```
RETRY BRIEFING (attempt {retry_count} of 8):
  Previous level: {gate_level}
  Tier: {current tier from sudd.yaml escalation ladder}
  Failures:
    {list from accumulated feedback}
  Key lessons:
    {top-3 from STEP 1b}

  FIX THESE SPECIFIC ISSUES. Do not rewrite from scratch.
```

### For retry 3+: Compressed Feedback (MANDATORY)
1. Read ALL `## Accumulated Feedback` entries from log.md
2. Compress into:
```
## Compressed Feedback (retry {N})
### STILL OPEN (fix these):
1. {issue} — first seen retry {N}, still failing
### RESOLVED (don't regress):
1. {issue} — fixed in retry {N}
### PATTERN (recurring blocker):
{the issue that keeps coming back}
```
3. Include ONLY compressed version in coder prompt (discard raw entries)
4. Context budget: task + design + compressed feedback + lessons ≤ 6000 tokens
5. Log: "Feedback compressed: {N} raw entries → {M} open issues"

---

## STEP 3: IMPLEMENT TASKS

For each pending task (or specified task):

### 3-pre. Task Ordering & Dispatch

When `/sudd:apply all` or multiple tasks are pending:

1. **Analyze dependencies**: Read each task's `Dependencies:`, `Files:`, and `SharedFiles:` fields
2. **Order tasks**:
   - Tasks are INDEPENDENT if: neither depends on the other AND their `Files:` AND `SharedFiles:` lists don't overlap
   - Group independent tasks into batches; dependent tasks go into later batches
   - Within each batch, execute tasks **sequentially** (default) or in parallel (opt-in)
3. **Default: Sequential execution** (one task at a time in main workspace):
   - Run tasks in dependency order within each batch
   - No worktree overhead, no merge risk, no implicit dependency issues
   - This is the default and recommended mode
4. **Opt-in: Worktree parallelization** (if `sudd.yaml` → `parallelization.mode: worktree`):
   - Only when batch size > 1 AND all conditions met (see `sudd/agents/context-manager.md` → Worktree Management)
   - Create worktree per task, dispatch in parallel, merge back sequentially
   - Before each merge: rebase worktree branch against current base to reduce conflicts
   - On merge conflict: abort, re-run that task sequentially in main workspace
   - On post-merge validation failure: `git revert` the merge commit, re-run task sequentially
   - Cleanup all worktrees after merge or conflict
   - First-time use may auto-commit a `.gitignore` change. All events logged to `log.md`
   - **Skip worktrees even in worktree mode** if: only 1 task in batch, all Effort: S, not in a git repo, or `git worktree add` fails mid-batch

5. **Model tier selection** (matches run.md Step 5b):
   - `Effort: S` AND ≤2 files → free tier (opencode/GLM)
   - `Effort: M` OR ≤4 files → standard tier (sonnet)
   - `Effort: L` OR >4 files → capable tier (opus)
   - Retry escalation (applies to ALL agents in the task):
     - retry 0-1: free tier for all
     - retry 2-3: free for coder, sonnet for validation agents only
     - retry 4-5: sonnet for all
     - retry 6-7: opus for all
     - retry 8+: STUCK

For single task (`/sudd:apply {task-id}`): always run in main workspace.

### 3-pre-a. Idempotency Check
For each task about to execute:
1. Read tasks.md — is this task marked `[x]`?
2. If `[x]`: check git log for commit message containing this task ID
3. If both `[x]` AND commit exists → **Skip.** Log: "Task {id} already completed (commit: {sha})"
4. If `[x]` but NO commit → WARNING: "Task marked complete but no commit found. Re-running."

### 3a. Task(agent=coder)
```
Read: agents/coder.md

Context:
  - Task description
  - Design for this component
  - Specs for interfaces
  - Related code patterns

Implement:
  - Create/modify files as designed
  - Follow existing patterns
  - Handle errors properly

Write: actual code files to disk
```

### 3b. Spec Compliance (contract-verifier)
```
Task(agent=contract-verifier)
Read: agents/contract-verifier.md
Input: specs.md contracts, code output from coder

Verify: does the code match the spec? Nothing missing, nothing extra.
If NON-COMPLIANT (any BREAKING violation OR level below EXEMPLARY):
  → Provide specific feedback to coder (file:line format)
  → Coder re-implements
  → Re-run 3b (spec compliance must pass BEFORE proceeding to 3c)
```

### 3c. Code Quality (peer-reviewer)
```
Task(agent=peer-reviewer)
Read: agents/peer-reviewer.md
Input: code output from coder, design.md, specs.md

Verify: is the code clean, tested, well-structured?
Checks: naming, error handling, test coverage, patterns, duplication
If quality issues found:
  → Provide specific feedback to coder (file:line format)
  → Coder fixes quality issues
  → Re-run 3c (quality must pass BEFORE proceeding to 3d)

Note: 3c ONLY runs after 3b passes. Fix spec issues first, then quality.
```

### 3d. Handoff Validation
```
Task(agent=handoff-validator):
  PRODUCER: coder
  CONSUMER: {next in chain from specs}
  CONTRACT: {from specs handoff section}
  OUTPUT: {actual code}

  Level: EXEMPLARY / STRONG / ACCEPTABLE / WEAK / BROKEN
  If below EXEMPLARY: classify error via blocker-detector → route (see ERROR HANDLING)

In sequential mode (default): runs per-task, validates before next task starts.
In worktree mode (opt-in): runs post-merge on integrated result. If validation
fails post-merge, the merge commit is reverted and the task re-runs sequentially.
```

### 3e. Mark Complete
Update `tasks.md`:
```markdown
- [x] T3: Implement API endpoints
  - Completed: {timestamp}
  - Files: api/endpoints.py, api/routes.py
```

Append to `log.md`:
```markdown
## {timestamp}
- Completed T3: Implement API endpoints
- Files created/modified: api/endpoints.py
```

### 3f. Track Files Modified
Append to `## Files Modified` in log.md:
```markdown
## Files Modified
- `{file_path}` — {task_id}: {description}
```

---

## STEP 4: CHECKPOINT

After each task or batch:
- Commit: `git add . && git commit -m "feat({change-id}): complete {task}"`
- Update state if phase change needed
  <!-- Phase transition: build → validate (valid, only when all tasks complete) -->

---

## OUTPUT

```
Applied: {change-id}

  ✓ T3: Implement API endpoints
    Files: api/endpoints.py, api/routes.py
    Handoff: ✓ passed (score: 96)

Progress: 3/5 complete

Next: Run /sudd:test to validate, or /sudd:apply to continue
```

---

## ERROR HANDLING (after step 3d failure or gate failure)

```
Task(agent=blocker-detector): Classify error

Read blocker-detector output → "Route To" field:
  - "coder":           increment retry, escalate tier per ladder, restart from 3a
  - "architect":       invoke architect to revise specs.md or design.md,
                       then restart from 3a with retry_count reset to 0
  - "context-manager": re-read vision.md + specs.md, clear stale context,
                       restart from 3a
  - "BLOCKED":         log blocker, skip to next task
```

Root-cause routing prevents wasting retries. SPEC_ERROR and DESIGN_FLAW go to architect, not coder with bigger model.

---

## GUARDRAILS

- Always read design before implementing
- Follow specs for interfaces exactly
- Validate handoffs at each step
- Commit after each task
- Update tasks.md checkboxes immediately
- Log progress to log.md

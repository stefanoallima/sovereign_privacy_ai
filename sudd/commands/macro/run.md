---
name: sudd:run
description: Full autonomous SUDD workflow — from vision to done
phase: all
macro: true
---

Full autonomous SUDD workflow. Runs the complete loop from vision to done.

**Input**: 
- `/sudd:run` — continue with current state
- `/sudd:run green "description"` — start fresh from vision (heavy research)
- `/sudd:run brown` — continue existing work (light discovery)
- `/sudd:run {change-id}` — work on specific change

---

Agent invocation follows `sudd/standards.md` → Agent Invocation.

---

## ORCHESTRATOR STARTUP

1. **Load state**: Read `sudd/state.json`
2. **Determine mode**:
   - If `green` in args → mode = green, extensive research
   - If `brown` in args → mode = brown, continue existing
   - If change-id provided → focus on that change
   - Else use existing state
3. **Check for port**: If `imported_from` set, validate port completed
4. **Display status**:
   ```
   SUDD AUTONOMOUS SESSION
   ════════════════════════
   Mode: green | brown
   Active: {change-id} | none
   Phase: {phase}
   Tasks: N active | M completed
   ```
5. **Read config**: Read `sudd/sudd.yaml` for agent tiers, escalation ladder, cost_mode
   - If missing: warn "No sudd.yaml found, defaulting all agents to free tier"

---

## MODE: GREEN (Vision → Implementation)

Used when starting from an idea/vision with minimal existing structure.

### Step 1: Discovery
```
Read: sudd/vision.md
Read: sudd/personas/*.md (if exist)
Search: codebase for related patterns

If vision.md is empty or vague:
  → Ask user for clarification (ONE question, then proceed)
  → Or use /sudd:chat to explore first
```

### Step 2: Create Change
```
Generate change-id: green_{name}_{seq:02d}
  - name: kebab-case from vision content
  - seq: next available number

Create: sudd/changes/active/{change-id}/
  - proposal.md (from vision)
  - specs.md (discovered requirements)
  - design.md (architecture)
  - tasks.md (implementation checklist)
  - log.md (execution log)

Update: sudd/state.json
  - active_change = {change-id}
  - phase = "planning"
  <!-- Phase transition: none → planning (valid) -->
```

### Step 3: Research Agents (parallel)
```
For each major component in vision:
  Task(agent=researcher): Investigate technology, patterns
  Task(agent=persona-detector): Discover consumers
  Task(agent=persona-researcher): Deep-research each consumer

Aggregate findings into specs.md
```

### Step 4: Planning
<!-- Phase transition: inception → planning (valid) -->
```
Task(agent=antigravity): Back-plan from outcome
Task(agent=deep-think): Align with vision
Task(agent=architect): Design solution

Task(agent=qa, mode=testability-review):
  - Read design.md acceptance criteria
  - Check testability of each criterion
  - Append ## Testability Notes to design.md

Write: design.md with architecture
Write: tasks.md with implementation tasks
Update: state.json phase = "build"
<!-- Phase transition: planning → build (valid) -->
```

### Step 5: Build Loop

#### 5a. Dependency Analysis
```
Read tasks.md. For each pending task, extract:
  - Dependencies: field (list of task IDs)
  - Files: field (list of file paths)
  - SharedFiles: field (lock files, configs, routers — files multiple tasks may touch)

Build batches:
  - Tasks are INDEPENDENT if ALL of:
    1. Neither lists the other in Dependencies:
    2. Their Files: lists have no overlap
    3. Their SharedFiles: lists have no overlap
  - Group independent tasks into ordered batches
  - Dependent tasks go into later batches

SharedFiles examples (architect should declare these):
  - package.json, go.mod, requirements.txt (dependency files)
  - database migrations with sequence numbers
  - router/route config files, index.ts barrel exports
  - .env.example, shared config files

Example:
  T1 (no deps, files: a.go) ─┐
  T2 (no deps, files: b.go) ─┼─ Batch 1
  T4 (no deps, files: d.go) ─┘
  T3 (deps: T1, files: a.go, c.go) → Batch 2 (after T1 completes)
```

#### 5b. Model Tier Selection
```
For each task in batch, select model tier based on complexity:

  task.effort == "S" AND task.files.length <= 2  → free tier (opencode/GLM)
  task.effort == "M" OR task.files.length <= 4   → standard tier (sonnet)
  task.effort == "L" OR files > 4                → capable tier (opus)

Override: SUDD escalation ladder on retries (per-task retry count):
  retry 0-1: free tier for all
  retry 2-3: free for coder, sonnet for validation agents only
  retry 4-5: sonnet for all
  retry 6-7: opus for all
  retry 8+: STUCK
```

#### 5c. Execute Batches
```
Read sudd.yaml → parallelization.mode (default: "sequential")

DEFAULT MODE: SEQUENTIAL
  STEP 1b: Inject top-3 lessons from memory/lessons.md (per apply.md STEP 1b)

  For each batch, run tasks one at a time in main workspace:
    For each task in batch:
      Idempotency check: skip if [x] + commit exists (per apply.md 3-pre-a)
      3a.  Task(agent=coder, tier={from 5b}): Implement task
      3b.  Task(agent=contract-verifier): Spec compliance (must pass before 3c)
      3c.  Task(agent=peer-reviewer): Code quality (must pass before 3d)
      3d.  Task(agent=handoff-validator): Validate output
      If 3d below EXEMPLARY: classify via blocker-detector → route (see ERROR HANDLING)
      Else: mark task complete, commit

  After all tasks in batch:
    Task(agent=qa): Write/run tests
    Task(agent=persona-validator): Level EXEMPLARY/STRONG/ACCEPTABLE/WEAK/BROKEN

  If all EXEMPLARY:
    → Commit with message
  Else:
    → Accumulate feedback to task-level retry counts
    → For each failed task: task.retry_count++
    → If task.retry < 8: re-run from 3a with escalated tier
    → Else: mark task STUCK, continue to next

OPT-IN MODE: WORKTREE (sudd.yaml parallelization.mode: worktree)
  For each batch:
    If batch.size == 1 or skip conditions met:
      → Run in main workspace (same as sequential above)

    If batch.size > 1:
      → Create worktree per task (via context-manager Worktree Management)
      → Dispatch each task in parallel:
          3a.  Task(agent=coder, tier={from 5b}): Implement task
          3b.  Task(agent=contract-verifier): Spec compliance
          3c.  Task(agent=peer-reviewer): Code quality
      → After all tasks complete, merge sequentially:
          - Before each merge: rebase worktree branch against current base
          - If rebase/merge conflicts: abort, mark task for sequential re-run
          - After each successful merge: run 3d handoff-validator on merged result
          - If 3d fails post-merge: git revert the merge commit, mark for sequential re-run
          - Cleanup all worktrees
      → Re-run any conflict/failed tasks sequentially in main workspace
      → All lifecycle events logged to log.md

    After batch completes (all tasks merged or re-run):
      Task(agent=qa): Write/run tests
      Task(agent=persona-validator): Score 0-100

    Skip worktrees even in worktree mode if:
      - batch.size == 1
      - All tasks have Effort: S (overhead exceeds benefit)
      - Not in a git repo
      - git worktree add fails mid-batch → log warning, cleanup, fall back to sequential
```

#### 5d. Per-Task Retry Tracking
```
Track retry counts per task, not globally:
  state.json.task_retries: { "T01": 0, "T02": 3, "T03": 1 }

Benefits:
  - Task that passed doesn't get re-run at higher tier unnecessarily
  - Escalation ladder applies per-task: T01 at free, T02 at sonnet (retry 3)
  - STUCK determination is per-task: T02 can be STUCK while T01 continues
```

### Step 6: Validate & Complete
<!-- Phase transition: build → validate (valid) -->
```
Task(agent=peer-reviewer): Final review
Task(agent=ux-tester): If UI, browser test
Task(agent=persona-validator): Final gate

If pass:
  → Archive change: sudd/changes/archive/{change-id}/
  → Update memory/lessons.md
  → Update state.json stats
  <!-- Phase transition: validate → complete (valid) -->
  → Commit all
Else:
  → Continue retry loop
```

---

## MODE: BROWN (Continue Existing)

Used when specs/code already exist.

### Step 1: Assess State
```
Read: sudd/state.json
Read: sudd/changes/active/{active_change}/*.md
Read: codebase for context

If no active change:
  → List available changes
  → Auto-select if only one
  → Else ask user
```

### Step 2: Continue from Phase
```
Switch on phase:
  case "inception": → run planning   <!-- Phase transition: inception → planning (valid) -->
  case "planning":  → continue design <!-- Phase transition: planning → build (valid) -->
  case "build":     → continue tasks  <!-- Phase transition: build → validate (valid) -->
  case "validate":  → run validation  <!-- Phase transition: validate → complete (valid) -->
  case "complete":  → archive
```

### Step 3: Build Loop
```
Same as green mode Step 5 (dependency analysis → sequential execution by default), including:
  - SharedFiles: overlap check for dependency analysis
  - Per-task retry tracking and escalation
  - Worktree parallelization if opted in via sudd.yaml
But:
  - Skip research phase (already done)
  - Use existing specs/design
  - Only run missing validations
```

---

## ESCALATION

```
Retry 0-1: opencode/GLM (free) for all
Retry 2-3: opencode for work, sonnet for validation
Retry 4-5: sonnet for all
Retry 6-7: opus for all
After 8:   STUCK → sudd/memory/stuck-history/{change-id}.md
```

---

## ERROR HANDLING

```
On any error:
  Task(agent=blocker-detector):
    - Classify: RETRY | BLOCKED | STUCK
    - Root Cause: LOGIC_ERROR | SPEC_ERROR | DESIGN_FLAW | CONTEXT_DRIFT | EXTERNAL_DEPENDENCY
    - Route To: coder | architect | context-manager | BLOCKED

  Route based on "Route To" field:
    "coder":           increment retry, escalate tier per ladder, restart from 3a
    "architect":       invoke architect to revise specs/design, restart with retry reset to 0
    "context-manager": re-read vision + specs, clear stale context, restart from 3a
    "BLOCKED":         log to sudd/results/{change-id}_BLOCKED.md, skip task

  STUCK: log to sudd/memory/stuck-history/, move on
```

---

## SESSION END

```
Update: sudd/state.json
  - last_run = now
  - stats updated

Output:
  ═══════════════════════════════════════
  SUDD SESSION COMPLETE
  ═══════════════════════════════════════
  Mode: green | brown
  Tasks completed: N
  Tasks stuck: N
  Tasks blocked: N
  Lessons learned: M new
  ═══════════════════════════════════════
```

---

## GUARDRAILS

1. **Never ask user** unless scope is unclear or major decision needed
2. **Never skip handoff validation** — every boundary validated
3. **Never skip persona gate** — mandatory for completion
4. **Always escalate on retry** — same tier won't magically succeed (per-task retry count)
5. **Always write files to disk** — no in-memory only
6. **Always read actual files for validation** — not summaries
7. **Budget conscious** — use free models when possible, select model tier by task complexity
8. **Sequential by default** — worktree parallelization is opt-in via `sudd.yaml` → `parallelization.mode: worktree`. Default is sequential: reliable, no merge risk
9. **Spec compliance before code quality** — always run contract-verifier before peer-reviewer (fix what's wrong before polishing)
10. **SharedFiles must be declared** — architect must list lock files, configs, routers in `SharedFiles:` per task. Tasks sharing any `SharedFiles:` entry are DEPENDENT
11. **Worktree mode only**: cleanup is mandatory — always remove worktrees after merge or conflict. Rebase before merge. Revert on post-merge validation failure. Track status per `sudd/agents/context-manager.md` → Worktree Management

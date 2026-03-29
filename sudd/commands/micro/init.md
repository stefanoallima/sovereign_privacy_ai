---
name: "SUDD: Init"
description: Initialize SUDD2 in any repository — copies agents, commands, memory structure, and personas
category: SUDD
tags: [sudd, init, setup]
---

You are initializing SUDD2 in the current repository. This sets up the full autonomous development framework with 20 agents, memory system, and orchestrator commands.

**Input**: Optional project description (e.g., `/sudd:init This is a FastAPI backend for consumer insights`)

---

## Step 1: Check if already initialized

Look for `agents/` folder and `.claude/commands/sudd/run.md`. If both exist:
```
SUDD2 already initialized in this repo.
Run /sudd:run to start processing tasks.
```
Stop here.

---

## Step 2: Create folder structure

Create these directories:
```
agents/
personas/
changes/active/
changes/archive/
memory/
memory/context-cache/
memory/stuck-history/
```

---

## Step 3: Copy agent files (20 agents)

Create each of the following agent `.md` files in `agents/`. Each file contains the full agent instructions.

**Copy from the sudd2 template repo.** If not available, create from the canonical definitions:

### Discovery & Research
1. `agents/researcher.md`
2. `agents/persona-detector.md`
3. `agents/persona-researcher.md`
4. `agents/task-discoverer.md`

### Planning
5. `agents/antigravity.md`
6. `agents/deep-think.md`
7. `agents/solution-explorer.md`
8. `agents/architect.md`
9. `agents/decomposer.md`

### Implementation
10. `agents/coder.md`
11. `agents/qa.md`

### Validation
12. `agents/handoff-validator.md`
13. `agents/contract-verifier.md`
14. `agents/peer-reviewer.md`
15. `agents/persona-validator.md`
16. `agents/ux-tester.md`
17. `agents/blocker-detector.md`

### System Management
18. `agents/learning-engine.md`
19. `agents/monitor.md`
20. `agents/context-manager.md`

**Source**: Read each file from `C:\Users\tucan\Documents\stefano\hackaton\huggingface_gradio\sudd2\agents\` and write to `{cwd}/agents/`.

If the sudd2 template path is not accessible, use WebFetch to get from the GitHub repo.

---

## Step 4: Create memory files

Write `memory/lessons.md`:
```markdown
# SUDD2 Lessons Learned

This file is updated automatically after each task. Agents read it to avoid repeating mistakes.

## Template
- **Task**: [name]
- **What worked**: [approach that succeeded]
- **What failed**: [approach that didn't work]
- **Lesson**: [takeaway for future tasks]

---

(No lessons yet — run `/sudd:run` to start building history)
```

Write `memory/patterns.md`:
```markdown
# SUDD2 Patterns

Patterns are lessons that appear 3+ times. Automatically promoted from `lessons.md` by the learning-engine agent.

## Failure Patterns

(No patterns detected yet)

## Success Patterns

(No patterns detected yet)
```

Write `memory/session-log.md`:
```markdown
# SUDD2 Session Log

Health reports from the monitor agent. Most recent first.

---

(No sessions yet)
```

---

## Step 5: Create default persona

Write `personas/default.md`:
```markdown
# Persona: Default End-User

This is the FALLBACK persona used when no specific consumer is detected. In practice, the persona-detector and persona-researcher agents construct task-specific consumer personas dynamically.

**Role:** Technical Lead / Project Owner
**Context:** Uses AI coding agents to build software autonomously. Returns expecting completed, documented, working code.

## Goals
1. Every task produces working code with clear documentation
2. The system runs autonomously without asking questions
3. When something fails, it retries with escalation — not a dead stop
4. Clear visibility into what was accomplished and what's still pending

## Frustrations
1. AI writes code that compiles but doesn't actually do anything useful
2. Systems that ask "what should I do?" instead of trying harder
3. Hours of compute time with nothing to show for it
4. Over-engineered solutions when something simple would work

## Success Criteria
> "I came back and the task is completed. The code works, it's documented, and I can see exactly what happened."

## Deal-Breakers
1. Empty/mock data in outputs — if the API returns `[]`, that's a fail
2. Code that doesn't run — syntax errors, missing imports
3. No tests — untested code is unfinished code
```

If the user provided a project description, customize the persona's Role and Context to match.

---

## Step 6: Create example change

Write `changes/active/example_getting-started_01/proposal.md`:
```markdown
# Change: example_getting-started_01

## Status
active

## What
This is a placeholder change. Delete this directory and create real changes with `/sudd:new`, or let the task-discoverer agent generate them.

## Why
Example for getting started with SUDD.

## Size: S
```

Write `changes/active/example_getting-started_01/tasks.md`:
```markdown
# Tasks: example_getting-started_01

- [ ] Replace this example with a real task
```

---

## Step 7: Update or create CLAUDE.md

If `CLAUDE.md` exists, append the SUDD2 section. If not, create it.

Add this block:
```markdown
<!-- SUDD2:START -->
## SUDD2 — Simulated User-Driven Development

This project uses SUDD2 for autonomous AI-driven development.

**Commands:**
- `/sudd:run` — Full autonomous session (Ralph loop, all 20 agents, escalation)
- `/sudd:new` — Create a new change proposal
- `/sudd:plan` — Create specs, design, and tasks
- `/sudd:apply` — Implement tasks
- `/sudd:test` — Run tests
- `/sudd:gate` — Persona validation gate
- `/sudd:done` — Archive completed change
- `/sudd:status` — Show session status

**Structure:**
- `agents/` — 20 agent instruction files (markdown)
- `personas/` — Who we're building for
- `changes/active/` — Active changes (proposals, specs, designs, tasks)
- `changes/archive/` — Completed/stuck changes
- `memory/` — Cross-task learning

**How it works:**
Claude Code IS the orchestrator. Agents are markdown instructions. No Python needed.
Zero external dependencies.
<!-- SUDD2:END -->
```

---

## Step 8: Initialize git (if not already)

If `.git/` doesn't exist: `git init`

Create `.gitignore` if it doesn't exist, add:
```
memory/context-cache/
```

---

## Step 9: Verify and report

Count files created. Print:

```
SUDD2 INITIALIZED
══════════════════
Agents:    20 (in agents/)
Personas:  1 default (in personas/)
Changes:   1 example (in changes/active/)
Memory:    3 files (lessons, patterns, session-log)
Commands:  /sudd:run, /sudd:add-task, /sudd:status

Next steps:
  1. Add tasks:     /sudd:add-task
  2. Run session:   /sudd:run
  3. Check status:  /sudd:status
══════════════════
```
